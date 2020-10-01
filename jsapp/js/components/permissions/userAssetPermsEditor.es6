import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import {permParser} from './permParser';
import permConfig from './permConfig';
import {
  assign,
  t,
  notify,
  buildUserUrl
} from 'js/utils';
import {
  ANON_USERNAME,
  KEY_CODES,
  PERMISSIONS_CODENAMES
} from 'js/constants';

const PARTIAL_PLACEHOLDER = t('Enter usernames separated by spaces');

// used for validity rules
const CHECKBOX_PERM_PAIRS = new Map([
  ['formView', PERMISSIONS_CODENAMES.get('view_asset')],
  ['formEdit', PERMISSIONS_CODENAMES.get('change_asset')],
  ['submissionsAdd', PERMISSIONS_CODENAMES.get('add_submissions')],
  ['submissionsAddPartial', PERMISSIONS_CODENAMES.get('partial_submissions')],
  ['submissionsView', PERMISSIONS_CODENAMES.get('view_submissions')],
  ['submissionsViewPartial', PERMISSIONS_CODENAMES.get('partial_submissions')],
  ['submissionsEdit', PERMISSIONS_CODENAMES.get('change_submissions')],
  ['submissionsEditPartial', PERMISSIONS_CODENAMES.get('partial_submissions')],
  ['submissionsValidate', PERMISSIONS_CODENAMES.get('validate_submissions')],
  ['submissionsValidatePartial', PERMISSIONS_CODENAMES.get('partial_submissions')],
]);

/**
 * Form for adding/changing user permissions for surveys.
 *
 * @prop uid - asset uid
 * @prop username - permissions user username (could be empty for new)
 * @prop permissions - list of permissions (could be empty for new)
 * @prop assignablePerms - list of assignable permissions for given asset type
 * @prop nonOwnerPerms - list of permissions with exclusion of the asset owner permissions
 * @prop onSubmitEnd - callback to be run when submit ends (success or failure)
 */
class UserAssetPermsEditor extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      // inner workings
      usernamesBeingChecked: new Set(),
      isSubmitPending: false,
      isEditingUsername: false,
      // form user inputs
      username: '',
      // form edit
      formView: false,
      formViewDisabled: false,
      // form edit
      formEdit: false,
      // submissions view
      submissionsView: false,
      submissionsViewDisabled: false,
      submissionsViewPartial: false,
      submissionsViewPartialDisabled: false,
      submissionsViewPartialUsers: [],
      // submissions add
      submissionsAdd: false,
      submissionsAddDisabled: false,
      submissionsAddPartial: false,
      submissionsAddPartialDisabled: false,
      submissionsAddPartialUsers: [],
      // submissions edit
      submissionsEdit: false,
      submissionsEditDisabled: false,
      submissionsEditPartial: false,
      submissionsEditPartialDisabled: false,
      submissionsEditPartialUsers: [],
      // submissions validate
      submissionsValidate: false,
      submissionsValidateDisabled: false,
      submissionsValidatePartial: false,
      submissionsValidatePartialDisabled: false,
      submissionsValidatePartialUsers: [],
    };

    this.applyPropsData();
  }

  /**
   * Fills up form with provided user name and permissions (if applicable)
   */
  applyPropsData() {
    if (this.props.permissions) {
      const formData = permParser.buildFormData(this.props.permissions);
      this.state = this.applyValidityRules(assign(this.state, formData));
    }

    if (this.props.username) {
      this.state.username = this.props.username;
    }
  }

  componentDidMount() {
    this.listenTo(actions.permissions.bulkSetAssetPermissions.completed, this.onBulkSetAssetPermissionCompleted);
    this.listenTo(actions.permissions.bulkSetAssetPermissions.failed, this.onBulkSetAssetPermissionFailed);
    this.listenTo(stores.userExists, this.onUserExistsStoreChange);
  }

  onBulkSetAssetPermissionCompleted() {
    this.setState({isSubmitPending: false});
    this.notifyParentAboutSubmitEnd(true);
  }

  onBulkSetAssetPermissionFailed() {
    this.setState({isSubmitPending: false});
    this.notifyParentAboutSubmitEnd(false);
  }

  notifyParentAboutSubmitEnd(isSuccess) {
    if (
      !this.state.isSubmitPending &&
      typeof this.props.onSubmitEnd === 'function'
    ) {
      this.props.onSubmitEnd(isSuccess);
    }
  }

  /**
   * Helps to avoid users submitting invalid data.
   *
   * Checking some of the checkboxes implies that other are also checked
   * and can't be unchecked.
   *
   * Checking some of the checkboxes implies that other can't be checked.
   *
   * @param {Object} state
   * @returns {Object} updated state
   */
  applyValidityRules(stateObj) {
    // enable all checkboxes before applying rules
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      stateObj[`${pairCheckbox}Disabled`] = false;
    });
    // apply permissions configuration rules to checkboxes
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      this.applyValidityRulesForCheckbox(pairCheckbox, stateObj);
    });
    // cleanup unchecked partial checkboxes users lists
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      if (
        pairCheckbox.endsWith('Partial') &&
        stateObj[pairCheckbox] === false
      ) {
        stateObj[`${pairCheckbox}Users`] = [];
      }
    });
    return stateObj;
  }

  /**
   * For given checkbox (permission) uses permissions config to fix all implied
   * and contradictory checkboxes (permissions).
   *
   * Modifies passed state object.
   */
  applyValidityRulesForCheckbox(checkboxName, stateObj) {
    // only applies the rules for checked checkboxes
    if (stateObj[checkboxName] === false) {
      return;
    }

    const permissionPair = this.getCheckboxPermissionPair(checkboxName);
    const impliedPerms = this.getImpliedPermissions(permissionPair);
    const contradictoryPerms = this.getContradictoryPermissions(permissionPair);

    // all implied will be checked and disabled
    impliedPerms.forEach((permUrl) => {
      const impliedPermDef = permConfig.getPermission(permUrl);
      const impliedCheckboxes = this.getPermissionCheckboxPairs(impliedPermDef.codename);
      impliedCheckboxes.forEach((impliedCheckbox) => {
        stateObj[impliedCheckbox] = true;
        stateObj[`${impliedCheckbox}Disabled`] = true;
      });
    });

    // all contradictory will be unchecked and disabled
    contradictoryPerms.forEach((permUrl) => {
      const contradictoryPermDef = permConfig.getPermission(permUrl);
      const contradictoryCheckboxes = this.getPermissionCheckboxPairs(contradictoryPermDef.codename);
      contradictoryCheckboxes.forEach((contradictoryCheckbox) => {
        stateObj[contradictoryCheckbox] = false;
        stateObj[`${contradictoryCheckbox}Disabled`] = true;
      });
    });
  }

  /**
   * Single callback for all checkboxes to keep the complex connections logic
   * being up to date regardless which one changed.
   */
  onCheckboxChange(id, isChecked) {
    // apply checked checkbox change to state
    const newState = this.state;
    newState[id] = isChecked;
    this.setState(this.applyValidityRules(newState));
  }

  /**
   * We need it just to update the input,
   * the real work is handled by onUsernameChangeEnd.
   */
  onUsernameChange(username) {
    this.setState({
      username: username,
      isEditingUsername: true
    });
  }

  /**
   * Checks if username exist on the Backend and clears input if doesn't.
   */
  onUsernameChangeEnd() {
    this.setState({isEditingUsername: false});

    if (this.state.username === '') {
      return;
    }

    const userCheck = this.checkUsernameSync(this.state.username);
    if (userCheck === undefined) {
      this.checkUsernameAsync(this.state.username);
    } else if (userCheck === false) {
      this.notifyUnknownUser(this.state.username);
      this.setState({username: ''});
    }
  }

  onInputKeyPress(key, evt) {
    if (key === KEY_CODES.get('ENTER')) {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  }

  /**
   * Generic function for updating partial users text input
   */
  onPartialUsersChange(prop, users) {
    const newState = this.state;
    newState[prop] = users.split(' ');
    this.setState(newState);
  }

  /**
   * This function returns either boolean (for known username) or undefined
   * for usernames that weren't checked before
   */
  checkUsernameSync(username) {
    return stores.userExists.checkUsername(username);
  }

  /**
   * This function calls API and relies on onUserExistsStoreChange callback
   */
  checkUsernameAsync(username) {
    const usernamesBeingChecked = this.state.usernamesBeingChecked;
    usernamesBeingChecked.add(username);
    this.setState({usernamesBeingChecked: usernamesBeingChecked});
    actions.misc.checkUsername(username);
  }

  notifyUnknownUser(username) {
    if (navigator.onLine) {
      notify(`${t('User not found:')} ${username}`, 'warning');
    }
  }

  /**
   * Remove nonexistent usernames from TagsInput list and from username input.
   */
  onUserExistsStoreChange(result) {
    // check partial view users
    const submissionsViewPartialUsers = this.state.submissionsViewPartialUsers;
    submissionsViewPartialUsers.forEach((username) => {
      if (result[username] === false) {
        submissionsViewPartialUsers.pop(submissionsViewPartialUsers.indexOf(username));
        this.notifyUnknownUser(username);
      }
    });
    this.setState({submissionsViewPartialUsers: submissionsViewPartialUsers});

    // check username
    if (result[this.state.username] === false) {
      this.notifyUnknownUser(this.state.username);
      this.setState({username: ''});
    }

    // clean usernamesBeingChecked array
    Object.keys(result).forEach((username) => {
      const usernamesBeingChecked = this.state.usernamesBeingChecked;
      usernamesBeingChecked.delete(username);
      this.setState({usernamesBeingChecked: usernamesBeingChecked});
    });
  }

  getCheckboxPermissionPair(checkboxName) {
    return CHECKBOX_PERM_PAIRS.get(checkboxName);
  }

  /**
   * Mulitple checkboxes have `partial_submissions`, so this function returns
   * an array of items
   */
  getPermissionCheckboxPairs(permCodename) {
    const found = [];
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      if (pairPermission === permCodename) {
        found.push(pairCheckbox);
      }
    });
    return found;
  }

  getImpliedPermissions(permCodename) {
    const permDef = permConfig.getPermissionByCodename(
      PERMISSIONS_CODENAMES.get(permCodename)
    );
    if (permDef) {
      return permDef.implied;
    } else {
      return [];
    }
  }

  getContradictoryPermissions(permCodename) {
    const permDef = permConfig.getPermissionByCodename(
      PERMISSIONS_CODENAMES.get(permCodename)
    );
    if (permDef) {
      return permDef.contradictory;
    } else {
      return [];
    }
  }

  getCheckboxLabel(checkboxName) {
    const permName = this.getCheckboxPermissionPair(checkboxName);
    const permDef = permConfig.getPermissionByCodename(permName);
    if (!permDef) {
      return false;
    } else {
      return this.props.assignablePerms.get(permDef.url);
    }
  }

  isAssignable(permCodename) {
    const permDef = permConfig.getPermissionByCodename(
      PERMISSIONS_CODENAMES.get(permCodename)
    );
    if (!permDef) {
      return false;
    } else {
      return this.props.assignablePerms.has(permDef.url);
    }
  }

  /**
   * Blocks submitting non-ready form.
   */
  isSubmitEnabled() {
    let isAnyCheckboxChecked = false;
    CHECKBOX_PERM_PAIRS.forEach((pairPermission, pairCheckbox) => {
      if (this.state[pairCheckbox] === true) {
        isAnyCheckboxChecked = true;
      }
    });

    return (
      isAnyCheckboxChecked &&
      this.isPartialValid('submissionsViewPartial') &&
      this.isPartialValid('submissionsAddPartial') &&
      this.isPartialValid('submissionsEditPartial') &&
      this.isPartialValid('submissionsValidatePartial') &&
      !this.state.isSubmitPending &&
      !this.state.isEditingUsername &&
      this.state.username.length > 0 &&
      this.state.usernamesBeingChecked.size === 0 &&
      // we don't allow manual setting anonymous user permissions through UI
      this.state.username !== ANON_USERNAME
    );
  }

  /**
   * Partial can't be empty if checked
   */
  isPartialValid(partialCheckboxName) {
    return this.state[partialCheckboxName] ? this.state[`${partialCheckboxName}Users`].length !== 0 : true;
  }

  /**
   * Returns only the properties for assignable permissions
   */
  getFormData() {
    const output = {
      username: this.state.username,
    };

    // use CHECKBOX_PERM_PAIRS on a loop for this

    if (this.isAssignable('view_asset')) {output.formView = this.state.formView;}
    if (this.isAssignable('change_asset')) {output.formEdit = this.state.formEdit;}
    if (this.isAssignable('add_submissions')) {output.submissionsAdd = this.state.submissionsAdd;}
    if (this.isAssignable('view_submissions')) {output.submissionsView = this.state.submissionsView;}
    if (this.isAssignable('partial_submissions')) {
      output.submissionsViewPartial = this.state.submissionsViewPartial;
      output.submissionsViewPartialUsers = this.state.submissionsViewPartialUsers;
    }
    if (this.isAssignable('change_submissions')) {output.submissionsEdit = this.state.submissionsEdit;}
    if (this.isAssignable('validate_submissions')) {output.submissionsValidate = this.state.submissionsValidate;}
    return output;
  }

  submit(evt) {
    evt.preventDefault();

    if (!this.isSubmitEnabled()) {
      return;
    }

    const formData = this.getFormData();

    // update perm parser

    const parsedUser = permParser.parseFormData(formData);

    if (parsedUser.length > 0) {
      // bulk endpoint needs all other users permissions to be passed
      let otherUserPerms = this.props.nonOwnerPerms.filter((perm) => {
        return perm.user !== buildUserUrl(formData.username);
      });
      this.setState({isSubmitPending: true});
      actions.permissions.bulkSetAssetPermissions(
        this.props.uid,
        otherUserPerms.concat(parsedUser)
      );
    } else {
      // if nothing changes but user submits, just notify parent we're good
      this.notifyParentAboutSubmitEnd(true);
    }

    return false;
  }

  render() {
    const isNew = typeof this.props.username === 'undefined';

    const formModifiers = [];
    if (this.state.isSubmitPending) {
      formModifiers.push('pending');
    }

    return (
      <bem.FormModal__form
        m={formModifiers}
        className='user-permissions-editor'
        onSubmit={this.submit}
      >
        {isNew &&
          // don't display username editor when editing existing user
          <div className='user-permissions-editor__row user-permissions-editor__row--username'>
            <TextBox
              placeholder={t('username')}
              value={this.state.username}
              onChange={this.onUsernameChange}
              onBlur={this.onUsernameChangeEnd}
              onKeyPress={this.onInputKeyPress}
              errors={this.state.username.length === 0}
            />
          </div>
        }

        <div className='user-permissions-editor__row'>
          {this.isAssignable('view_asset') &&
            <Checkbox
              checked={this.state.formView}
              disabled={this.state.formViewDisabled}
              onChange={this.onCheckboxChange.bind(this, 'formView')}
              label={this.getCheckboxLabel('formView')}
            />
          }

          {this.isAssignable('change_asset') &&
            <Checkbox
              checked={this.state.formEdit}
              onChange={this.onCheckboxChange.bind(this, 'formEdit')}
              label={this.getCheckboxLabel('formEdit')}
            />
          }

          {this.isAssignable('view_submissions') &&
            <Checkbox
              checked={this.state.submissionsView}
              disabled={this.state.submissionsViewDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsView')}
              label={this.getCheckboxLabel('submissionsView')}
            />
          }

          {this.isAssignable('partial_submissions') &&
            <div className='user-permissions-editor__sub-row'>
              <Checkbox
                checked={this.state.submissionsViewPartial}
                disabled={this.state.submissionsViewPartialDisabled}
                onChange={this.onCheckboxChange.bind(this, 'submissionsViewPartial')}
                label={this.getCheckboxLabel('submissionsViewPartial')}
              />

              {this.state.submissionsViewPartial === true &&
                <TextBox
                  placeholder={PARTIAL_PLACEHOLDER}
                  value={this.state.submissionsViewPartialUsers.join(' ')}
                  onChange={this.onPartialUsersChange.bind(this, 'submissionsViewPartialUsers')}
                  errors={this.state.submissionsViewPartial && this.state.submissionsViewPartialUsers.length === 0}
                  onKeyPress={this.onInputKeyPress}
                />
              }
            </div>
          }

          {this.isAssignable('add_submissions') &&
            <Checkbox
              checked={this.state.submissionsAdd}
              disabled={this.state.submissionsAddDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsAdd')}
              label={this.getCheckboxLabel('submissionsAdd')}
            />
          }

          {this.isAssignable('partial_submissions') &&
            <div className='user-permissions-editor__sub-row'>
              <Checkbox
                checked={this.state.submissionsAddPartial}
                disabled={this.state.submissionsAddPartialDisabled}
                onChange={this.onCheckboxChange.bind(this, 'submissionsAddPartial')}
                label={this.getCheckboxLabel('submissionsAddPartial')}
              />

              {this.state.submissionsAddPartial === true &&
                <TextBox
                  placeholder={PARTIAL_PLACEHOLDER}
                  value={this.state.submissionsAddPartialUsers.join(' ')}
                  onChange={this.onPartialUsersChange.bind(this, 'submissionsAddPartialUsers')}
                  errors={this.state.submissionsAddPartial && this.state.submissionsAddPartialUsers.length === 0}
                  onKeyPress={this.onInputKeyPress}
                />
              }
            </div>
          }

          {this.isAssignable('change_submissions') &&
            <Checkbox
              checked={this.state.submissionsEdit}
              disabled={this.state.submissionsEditDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsEdit')}
              label={this.getCheckboxLabel('submissionsEdit')}
            />
          }

          {this.isAssignable('partial_submissions') &&
            <div className='user-permissions-editor__sub-row'>
              <Checkbox
                checked={this.state.submissionsEditPartial}
                disabled={this.state.submissionsEditPartialDisabled}
                onChange={this.onCheckboxChange.bind(this, 'submissionsEditPartial')}
                label={this.getCheckboxLabel('submissionsEditPartial')}
              />

              {this.state.submissionsEditPartial === true &&
                <TextBox
                  placeholder={PARTIAL_PLACEHOLDER}
                  value={this.state.submissionsEditPartialUsers.join(' ')}
                  onChange={this.onPartialUsersChange.bind(this, 'submissionsEditPartialUsers')}
                  errors={this.state.submissionsEditPartial && this.state.submissionsEditPartialUsers.length === 0}
                  onKeyPress={this.onInputKeyPress}
                />
              }
            </div>
          }

          {this.isAssignable('validate_submissions') &&
            <Checkbox
              checked={this.state.submissionsValidate}
              disabled={this.state.submissionsValidateDisabled}
              onChange={this.onCheckboxChange.bind(this, 'submissionsValidate')}
              label={this.getCheckboxLabel('submissionsValidate')}
            />
          }

          {this.isAssignable('partial_submissions') &&
            <div className='user-permissions-editor__sub-row'>
              <Checkbox
                checked={this.state.submissionsValidatePartial}
                disabled={this.state.submissionsValidatePartialDisabled}
                onChange={this.onCheckboxChange.bind(this, 'submissionsValidatePartial')}
                label={this.getCheckboxLabel('submissionsValidatePartial')}
              />

              {this.state.submissionsValidatePartial === true &&
                <TextBox
                  placeholder={PARTIAL_PLACEHOLDER}
                  value={this.state.submissionsValidatePartialUsers.join(' ')}
                  onChange={this.onPartialUsersChange.bind(this, 'submissionsValidatePartialUsers')}
                  errors={this.state.submissionsValidatePartial && this.state.submissionsValidatePartialUsers.length === 0}
                  onKeyPress={this.onInputKeyPress}
                />
              }
            </div>
          }
        </div>

        <div className='user-permissions-editor__row'>
          <bem.KoboButton
            m='blue'
            type='submit'
            disabled={!this.isSubmitEnabled()}
            >
              {isNew ? t('Grant permissions') : t('Update permissions')}
            </bem.KoboButton>
        </div>
      </bem.FormModal__form>
    );
  }
}
reactMixin(UserAssetPermsEditor.prototype, Reflux.ListenerMixin);

export default UserAssetPermsEditor;
