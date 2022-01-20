from django.utils import timezone

ACTION_NEEDED = 'ACTION_NEEDED'
PASSES = 'PASSES'

class BaseAction:
    ID = None
    _destination_field = '_supplementalDetails'

    DATE_CREATED_FIELD = 'dateCreated'
    DATE_MODIFIED_FIELD = 'dateModified'

    def __init__(self, params):
        self.load_params(params)

    def load_params(self, params):
        raise NotImplementedError('subclass must define a load_params method')

    def run_change(self, params):
        raise NotImplementedError('subclass must define a run_change method')

    def check_submission_status(self, submission):
        return PASSES

    def modify_jsonschema(self, schema):
        return schema

    def compile_revised_record(self, content, edits):
        '''
        a method that applies changes to a json structure and appends previous
        changes to a revision history
        '''
        if self.ID is None:
            return content
        for field_name, vals in edits.items():
            if field_name == 'submission':
                continue
            erecord = vals.get(self.ID)
            o_keyval = content.get(field_name, {})
            orecord = o_keyval.get(self.ID)
            if erecord is None:
                continue
            if orecord is None:
                compiled_record = self.init_field(erecord)
            elif not self.has_change(orecord, erecord):
                continue
            else:
                compiled_record = self.revise_field(orecord, erecord)
            o_keyval[self.ID] = compiled_record
            content[field_name] = o_keyval
        return content

    def init_field(self, edit):
        edit[self.DATE_CREATED_FIELD] = \
            edit[self.DATE_MODIFIED_FIELD] = \
            str(timezone.now()).split('.')[0]
        return {**edit, 'revisions': []}

    def revise_field(self, original, edit):
        record = {**original}
        revisions = record.pop('revisions', [])
        if self.DATE_CREATED_FIELD in record:
            del record[self.DATE_CREATED_FIELD]
        edit[self.DATE_MODIFIED_FIELD] = \
            edit[self.DATE_CREATED_FIELD] = \
            str(timezone.now()).split('.')[0]
        if len(revisions) > 0:
            edit[self.DATE_CREATED_FIELD] = \
                revisions[-1][self.DATE_MODIFIED_FIELD]
        return {**edit, 'revisions': [record, *revisions]}

    def record_repr(self, record):
        return record.get('value')

    def has_change(self, original, edit):
        return self.record_repr(original) != self.record_repr(edit)

    @classmethod
    def build_params(kls, *args, **kwargs):
        raise NotImplementedError(f'{kls.__name__} has not implemented a build_params method')

    @classmethod
    def build_params__valid(kls, *args, **kwargs):
        '''
        a shortcut for tests that builds params and then runs them through the action's
        param validator
        '''
        params = kls.build_params(*args, **kwargs)
        # check that they match schema
        return params
