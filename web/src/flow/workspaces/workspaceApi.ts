import { apiFetch } from "../../lib/api";

export type WorkspaceDTO = {
  id: string;
  title: string;
};

export async function listWorkspaces(): Promise<WorkspaceDTO[] | null> {
  const res = await apiFetch("/api/workspaces");
  if (!res.ok) return null;
  return (await res.json()) as WorkspaceDTO[];
}

export async function createWorkspace(params: {
  title: string;
}): Promise<WorkspaceDTO | null> {
  const res = await apiFetch("/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title }),
  });
  if (!res.ok) return null;
  return (await res.json()) as WorkspaceDTO;
}

export async function updateWorkspaceTitle(params: {
  workspaceId: string;
  title: string;
}): Promise<void> {
  await apiFetch(`/api/workspaces/${params.workspaceId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: params.title }),
  });
}

export async function deleteWorkspace(params: {
  workspaceId: string;
}): Promise<void> {
  await apiFetch(`/api/workspaces/${params.workspaceId}`, {
    method: "DELETE",
  });
}
