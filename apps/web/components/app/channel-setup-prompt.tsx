import { ShieldCheck } from 'lucide-react';

interface ChannelSetupPromptProps {
  actionLabel: string;
  description: string;
  onAction: () => void;
  title: string;
}

export function ChannelSetupPrompt({
  actionLabel,
  description,
  onAction,
  title,
}: ChannelSetupPromptProps) {
  return (
    <div className="channel-setup-prompt">
      <span aria-hidden="true">
        <ShieldCheck size={20} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button
        className="button secondary-button"
        onClick={onAction}
        type="button"
      >
        {actionLabel}
      </button>
    </div>
  );
}
