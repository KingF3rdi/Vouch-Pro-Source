'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function DiscordJoinButton({ className = 'btn btn-outline-glass' }) {
  const [inviteUrl, setInviteUrl] = useState('https://discord.gg/UjH99aR5ph');

  useEffect(() => {
    api.getDiscordConfig().then((c) => setInviteUrl(c.invite_url)).catch(() => {});
  }, []);

  return (
    <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className={className}>
      Discord beitreten
    </a>
  );
}
