import { supabase } from "@/lib/supabase"

export async function trackProjectAccess(
  projectId: string,
  userId: string,
  workspaceId: string
) {
  await supabase
    .from('project_last_accessed')
    .upsert(
      { user_id: userId, project_id: projectId, workspace_id: workspaceId, last_accessed_at: new Date().toISOString() },
      { onConflict: 'user_id,project_id' }
    )
}

export async function getRecentProjects(userId: string, workspaceId: string, limit = 5) {
  const { data } = await supabase
    .from('project_last_accessed')
    .select(`
      last_accessed_at,
      projects (
        id, name, color, workspace_id, is_private
      )
    `)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .order('last_accessed_at', { ascending: false })
    .limit(limit)

  return data?.map(row => row.projects) ?? []
}

export async function getProjectUnreadCount(
  projectId: string,
  userId: string
): Promise<number> {
  const { data: readData } = await supabase
    .from('project_chat_reads')
    .select('last_read_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  const lastReadAt = readData?.last_read_at ?? '1970-01-01'

  const { count } = await supabase
    .from('project_messages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .neq('sender_id', userId)
    .gt('created_at', lastReadAt)

  return count ?? 0
}
