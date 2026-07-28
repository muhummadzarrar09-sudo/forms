-- Supports owner dashboards, cursor pagination, response caps, summary queries,
-- workspace listing, and form/question ordering without full-table scans.
CREATE INDEX "Form_userId_updatedAt_idx" ON "Form"("userId", "updatedAt");
CREATE INDEX "Form_workspaceId_idx" ON "Form"("workspaceId");
CREATE INDEX "Workspace_userId_order_idx" ON "Workspace"("userId", "order");
CREATE INDEX "Question_formId_order_idx" ON "Question"("formId", "order");
CREATE INDEX "Response_formId_startedAt_idx" ON "Response"("formId", "startedAt");
CREATE INDEX "Response_formId_isPartial_idx" ON "Response"("formId", "isPartial");
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");
CREATE INDEX "FormEnding_formId_order_idx" ON "FormEnding"("formId", "order");
