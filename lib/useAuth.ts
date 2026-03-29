import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export function useRequireAuth() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth');
      } else {
        setUserId(user.id);
      }
      setChecking(false);
    });
  }, []);

  return { userId, checking };
}

export function useRedirectIfAuthed() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        // Check if already has workspace
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (membership) {
          router.replace(`/workspace/${membership.workspace_id}`);
        } else {
          router.replace('/onboarding');
        }
      }
      setChecking(false);
    });
  }, []);

  return { checking };
}