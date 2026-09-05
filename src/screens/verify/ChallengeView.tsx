import type { StampChallenge } from '@stamps/index';
import type { FlowState } from './useVerify';
import { InputChallenge } from './challenges/InputChallenge';
import { RedirectChallenge } from './challenges/RedirectChallenge';
import { DeeplinkChallenge } from './challenges/DeeplinkChallenge';
import { PollingChallenge } from './challenges/PollingChallenge';

export type RunningFlow = Extract<FlowState, { step: 'running' }>;

/**
 * One switch, over shapes. Four renderers, forever.
 *
 * Shared by the accounts screen and the onboarding verify step so there is
 * exactly one place that knows how a challenge looks. No provider is named
 * here — an ESLint rule bans the literals under screens/ — so a seventh
 * provider is a registry line and no work in this folder at all.
 */
export function ChallengeView({
  flow,
  submit,
  cancel,
  openAndReturn,
}: {
  flow: RunningFlow;
  submit: (answer: string) => void;
  cancel: () => void;
  openAndReturn: (challenge: StampChallenge) => void;
}) {
  const { provider, challenge, poll } = flow;
  switch (challenge.mode) {
    case 'input':
      return <InputChallenge challenge={challenge} onSubmit={submit} onCancel={cancel} />;
    case 'redirect':
      return (
        <RedirectChallenge
          challenge={challenge}
          label={provider.display.label}
          onSubmit={submit}
          onCancel={cancel}
        />
      );
    case 'deeplink':
      return (
        <DeeplinkChallenge
          challenge={challenge}
          {...(poll ? { poll } : {})}
          onOpen={() => openAndReturn(challenge)}
          onCancel={cancel}
        />
      );
    case 'polling':
      return (
        <PollingChallenge challenge={challenge} {...(poll ? { poll } : {})} onCancel={cancel} />
      );
  }
}
