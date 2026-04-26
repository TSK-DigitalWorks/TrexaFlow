import { supabase } from "@/lib/supabase";

export async function markChannelRead(channelId: string, userId: string) {
  const { error } = await supabase
    .from('channel_reads')
    .upsert(
      { channel_id: channelId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'channel_id,user_id' }
    );
  if (error) console.error(error);
}

export async function markDMRead(userId: string, otherUserId: string, workspaceId: string) {
  const { error } = await supabase
    .from('dm_reads')
    .upsert(
      { user_id: userId, other_user_id: otherUserId, workspace_id: workspaceId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,other_user_id,workspace_id' }
    );
  if (error) console.error(error);
}

export async function markProjectChatRead(projectId: string, userId: string) {
  const { error } = await supabase
    .from('project_chat_reads')
    .upsert(
      { project_id: projectId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'project_id,user_id' }
    );
  if (error) console.error(error);
}

export async function getChannelUnreadCount(channelId: string, userId: string): Promise<number> {
  const { data: readData } = await supabase
    .from('channel_reads')
    .select('last_read_at')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .maybeSingle();

  const lastReadAt = readData?.last_read_at ?? '1970-01-01';

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .neq('sender_id', userId)
    .gt('created_at', lastReadAt);

  return count ?? 0;
}

export async function getDMUnreadCount(userId: string, otherUserId: string, workspaceId: string): Promise<number> {
  const { data: readData } = await supabase
    .from('dm_reads')
    .select('last_read_at')
    .eq('user_id', userId)
    .eq('other_user_id', otherUserId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const lastReadAt = readData?.last_read_at ?? '1970-01-01';

  const { count } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', otherUserId)
    .eq('receiver_id', userId)
    .eq('workspace_id', workspaceId)
    .gt('created_at', lastReadAt);

  return count ?? 0;
}
