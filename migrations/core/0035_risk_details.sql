-- RISK-002: versioned scale definitions and provenance. Legacy definitions
-- remain explicitly unrecorded; no historic assessment is rescored.
ALTER TABLE risk_methods ADD COLUMN likelihood_definitions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE risk_methods ADD COLUMN impact_definitions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE risks ADD COLUMN library_revision INTEGER;
-- Materialize the previously implicit method for existing default assessments.
-- Its definitions were never recorded; the newly shipped descriptions must not
-- be projected back onto those assessments.
INSERT INTO risk_methods(id,revision,scale,likelihood_labels,impact_labels,formula,matrix_json,thresholds_json,actor_name,at)
SELECT 'legacy-shipped-method',1,5,'["Rare","Unlikely","Possible","Likely","Almost certain"]','["Negligible","Minor","Moderate","Major","Severe"]','product','[]','[{"level":"Low","max":4},{"level":"Medium","max":9},{"level":"High","max":16},{"level":"Critical","max":25}]','Evidence (shipped default)',''
WHERE EXISTS(SELECT 1 FROM risk_assessments WHERE method_revision=1) AND NOT EXISTS(SELECT 1 FROM risk_methods WHERE revision=1);
