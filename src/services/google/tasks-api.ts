import type { GoogleTask, GoogleTaskList } from "@/types/widget";

export type GoogleRequest = <T>(
  method: string,
  url: string,
  body?: unknown,
  accountId?: string | null,
) => Promise<T>;

/** Task-only API adapter. The injected transport keeps account ownership and native security checks intact. */
export function createTasksApi(request: GoogleRequest, getAccountId: () => string | null) {
  return {
    async taskLists(accountId = getAccountId()) {
      const result = await request<{ items?: GoogleTaskList[] }>(
        "GET",
        "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100",
        undefined,
        accountId,
      );
      return result.items ?? [];
    },

    async tasks(listId: string, accountId = getAccountId()) {
      const params = new URLSearchParams({
        maxResults: "100",
        showCompleted: "true",
        showHidden: "true",
      });
      const items: GoogleTask[] = [];
      const seen = new Set<string>();
      let pageToken = "";
      do {
        if (pageToken) params.set("pageToken", pageToken);
        const page = await request<{ items?: GoogleTask[]; nextPageToken?: string }>(
          "GET",
          `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?${params}`,
          undefined,
          accountId,
        );
        items.push(...(page.items ?? []).filter((task) => !task.deleted));
        pageToken = page.nextPageToken ?? "";
        if (pageToken && seen.has(pageToken)) throw new Error("GOOGLE_API_ERROR");
        seen.add(pageToken);
      } while (pageToken);
      return { items };
    },

    addTask(
      listId: string,
      values: { title: string; description: string; dueDate: string },
      accountId = getAccountId(),
    ) {
      return request<GoogleTask>(
        "POST",
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`,
        {
          title: values.title,
          notes: values.description,
          ...(values.dueDate ? { due: `${values.dueDate}T00:00:00.000Z` } : {}),
        },
        accountId,
      );
    },

    completeRemoteTask(listId: string, task: GoogleTask, accountId = getAccountId()) {
      return request(
        "PATCH",
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task.id)}`,
        {
          status: task.status === "completed" ? "needsAction" : "completed",
          ...(task.status === "completed" ? { completed: null } : {}),
        },
        accountId,
      );
    },

    updateTask(
      listId: string,
      task: GoogleTask,
      values: { title: string; description: string; dueDate: string },
      accountId = getAccountId(),
    ) {
      return request<GoogleTask>(
        "PATCH",
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task.id)}`,
        {
          title: values.title,
          ...(task.assignmentInfo?.surfaceType === "DOCUMENT" ? {} : { notes: values.description }),
          due: values.dueDate ? `${values.dueDate}T00:00:00.000Z` : null,
        },
        accountId,
      );
    },

    deleteTask(listId: string, taskId: string, accountId = getAccountId()) {
      return request(
        "DELETE",
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
        undefined,
        accountId,
      );
    },
  };
}
