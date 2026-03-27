interface WorkspacePageProps {
  params: {
    workspaceId: string;
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  return (
    <main>
      <h1>Workspace {params.workspaceId}</h1>
      <p>This is your TrexaFlow workspace.</p>
    </main>
  );
}
