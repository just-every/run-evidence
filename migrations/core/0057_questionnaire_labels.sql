-- Correct the legacy shipped questionnaire's label; imported licensed CAIQ
-- templates have UUIDs and are unaffected. This changes no question or answer.
UPDATE vendor_requests SET template_id='ccm-v4-evidence', template_name='CCM v4 control questionnaire (Evidence wording)', label='CCM v4 control questionnaire (Evidence wording) (revision 1)' WHERE template_id='caiq-v4';
