const { validateContext } = require('./context-contract');

const SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

function isValidProposal(proposal) {
  return Boolean(
    proposal &&
    typeof proposal.classification === 'string' &&
    proposal.classification.length <= 64 &&
    typeof proposal.risk === 'string' &&
    proposal.risk.length <= 64 &&
    typeof proposal.recommended_action === 'string' &&
    proposal.recommended_action.trim().length > 0 &&
    proposal.recommended_action.length <= 128
  );
}

function isValidPolicy(policy) {
  if (
    !policy ||
    typeof policy.policy_id !== 'string' ||
    !SLUG_PATTERN.test(policy.policy_id) ||
    typeof policy.version !== 'string' ||
    !policy.version.trim() ||
    policy.version.length > 64 ||
    typeof policy.domain !== 'string' ||
    !SLUG_PATTERN.test(policy.domain) ||
    !Array.isArray(policy.allowed_proposals) ||
    policy.allowed_proposals.length === 0 ||
    policy.allowed_proposals.length > 128
  ) {
    return false;
  }

  return policy.allowed_proposals.every((entry) =>
    entry &&
    typeof entry.classification === 'string' &&
    typeof entry.risk === 'string' &&
    typeof entry.recommended_action === 'string' &&
    typeof entry.action === 'string' &&
    SLUG_PATTERN.test(entry.action)
  );
}

function createDecision(context, policy, status, reasonCode, actionPreview = null) {
  return {
    decision_id: `${context.context_id}:${policy ? policy.policy_id : 'unconfigured'}:${policy ? policy.version : 'none'}`,
    context_id: context.context_id,
    domain: context.domain,
    status,
    reason_code: reasonCode,
    policy_id: policy ? policy.policy_id : null,
    policy_version: policy ? policy.version : null,
    execution: {
      mode: 'dry_run',
      attempted: false
    },
    action_preview: actionPreview
  };
}

function evaluateDecision({ context, proposal, policy = null }) {
  try {
    validateContext(context);
  } catch {
    return {
      context_id: context && context.context_id ? context.context_id : null,
      domain: context && context.domain ? context.domain : null,
      status: 'BLOCKED',
      reason_code: 'INVALID_CONTEXT',
      policy_id: null,
      policy_version: null,
      execution: { mode: 'dry_run', attempted: false },
      action_preview: null
    };
  }

  if (!isValidProposal(proposal)) {
    return createDecision(context, null, 'BLOCKED', 'INVALID_PROPOSAL');
  }

  if (!policy) {
    return createDecision(context, null, 'BLOCKED', 'POLICY_MISSING');
  }

  if (!isValidPolicy(policy)) {
    return createDecision(context, null, 'BLOCKED', 'POLICY_INVALID');
  }

  if (
    policy.approval_status !== 'approved' ||
    typeof policy.approved_by !== 'string' ||
    !policy.approved_by.trim() ||
    policy.approved_by.length > 128 ||
    typeof policy.approved_at !== 'string' ||
    !Number.isFinite(Date.parse(policy.approved_at))
  ) {
    return createDecision(context, policy, 'BLOCKED', 'POLICY_NOT_APPROVED');
  }

  if (policy.domain !== context.domain) {
    return createDecision(context, policy, 'BLOCKED', 'POLICY_DOMAIN_MISMATCH');
  }

  const matchingProposal = policy.allowed_proposals.find((entry) =>
    entry.classification === proposal.classification &&
    entry.risk === proposal.risk &&
    entry.recommended_action === proposal.recommended_action
  );

  if (!matchingProposal) {
    return createDecision(context, policy, 'BLOCKED', 'PROPOSAL_NOT_ALLOWED');
  }

  return createDecision(
    context,
    policy,
    'SIMULATED',
    'MATCHED_APPROVED_POLICY',
    { action: matchingProposal.action }
  );
}

module.exports = {
  evaluateDecision
};