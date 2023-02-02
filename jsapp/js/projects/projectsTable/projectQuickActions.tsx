import React from 'react';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import {ASSET_TYPES} from 'js/constants';
import Button from 'js/components/common/button';
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';
import styles from './projectQuickActions.module.scss';
import {getAssetDisplayName} from 'jsapp/js/assetUtils';
import {
  archiveAsset,
  unarchiveAsset,
  deleteAsset,
  openInFormBuilder,
  manageAssetSharing,
  cloneAsset,
  replaceAssetForm,
  manageAssetLanguages,
  cloneAssetAsTemplate,
  cloneAssetAsSurvey,
} from 'jsapp/js/assetQuickActions';
import {downloadUrl} from 'jsapp/js/utils';
import type {IconName} from 'jsapp/fonts/k-icons';
import {userCan} from 'jsapp/js/components/permissions/utils';

interface ProjectQuickActionsProps {
  asset: AssetResponse | ProjectViewAsset;
}

export default function ProjectQuickActions(props: ProjectQuickActionsProps) {
  // The `userCan` method requires `permissions` property to be present in the
  // `asset` object. For performance reasons `ProjectViewAsset` doesn't have
  // that property, and it is fine, as we don't expect Project View to have
  // a lot of options available.
  let isEditingPossible = false;
  if ('permissions' in props.asset) {
    isEditingPossible = userCan('change_asset', props.asset);
  }

  return (
    <div className={styles.root}>
      {isEditingPossible && props.asset.asset_type !== ASSET_TYPES.collection.id && (
        <Button
          type='bare'
          color='storm'
          size='s'
          startIcon='edit'
          tooltip={t('Edit in Form Builder')}
          onClick={() => openInFormBuilder(props.asset.uid)}
        />
      )}

      {isEditingPossible &&
        props.asset.asset_type === ASSET_TYPES.survey.id &&
        props.asset.has_deployment &&
        props.asset.deployment__active && (
          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='archived'
            tooltip={t('Archive project')}
            onClick={() => archiveAsset(props.asset)}
          />
        )}

      {isEditingPossible &&
        props.asset.asset_type === ASSET_TYPES.survey.id &&
        props.asset.has_deployment &&
        props.asset.deployment__active && (
          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='archived'
            tooltip={t('Unarchive project')}
            onClick={() => unarchiveAsset(props.asset)}
          />
        )}

      <Button
        type='bare'
        color='storm'
        size='s'
        startIcon='user-share'
        tooltip={t('Share project')}
        onClick={() => manageAssetSharing(props.asset.uid)}
      />

      <KoboDropdown
        name='project-quick-actions'
        placement='down-left'
        hideOnMenuClick
        triggerContent={
          <Button type='bare' color='storm' size='s' startIcon='more' />
        }
        menuContent={
          <div className={styles.menu}>
            <Button
              type='bare'
              color='storm'
              size='s'
              startIcon='duplicate'
              onClick={() => cloneAsset(props.asset)}
              label={t('Clone')}
            />

            {isEditingPossible &&
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='replace'
                onClick={() => replaceAssetForm(props.asset)}
                label={t('Replace form')}
              />
            }

            {isEditingPossible &&
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='language'
                onClick={() => manageAssetLanguages(props.asset.uid)}
                label={t('Manage translations')}
              />
            }

            {'downloads' in props.asset &&
              props.asset.downloads.map((file) => {
                let icon: IconName = 'file';
                if (file.format === 'XML') {
                  icon = 'file-xml';
                } else if (file.format === 'XLS') {
                  icon = 'file-xls';
                }

                return (
                  <Button
                    key={file.format}
                    type='bare'
                    color='storm'
                    size='s'
                    startIcon={icon}
                    onClick={() => downloadUrl(file.url)}
                    label={
                      <span>
                        {t('Download')}&nbsp;
                        {file.format.toString().toUpperCase()}
                      </span>
                    }
                  />
                );
              })
            }

            {props.asset.asset_type === ASSET_TYPES.survey.id && (
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='template'
                onClick={cloneAssetAsTemplate.bind(
                  null,
                  props.asset.uid,
                  getAssetDisplayName(props.asset).final
                )}
                label={t('Create template')}
              />
            )}

            {props.asset.asset_type === ASSET_TYPES.template.id && (
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='projects'
                onClick={cloneAssetAsSurvey.bind(
                  null,
                  props.asset.uid,
                  getAssetDisplayName(props.asset).final
                )}
                label={t('Create project')}
              />
            )}

            {isEditingPossible && (
              <Button
                type='bare'
                color='storm'
                size='s'
                startIcon='trash'
                onClick={() =>
                  deleteAsset(
                    props.asset,
                    getAssetDisplayName(props.asset).final,
                    () => {
                      console.log('after delete');
                    }
                  )
                }
                label={t('Delete')}
              />
            )}
          </div>
        }
      />
    </div>
  );
}
