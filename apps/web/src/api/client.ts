import type { CourseListItem, CourseState, StatusEvent } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const env = import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } };

export const API_BASE_URL =
  env.env?.VITE_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status} ${response.statusText}`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function unwrapCourses(payload: CourseListItem[] | { courses?: CourseListItem[] }): CourseListItem[] {
  return Array.isArray(payload) ? payload : payload.courses ?? [];
}

function getCourseId(payload: CourseListItem | CourseState | { course_id?: string }): string | undefined {
  return payload.course_id;
}

export async function listCourses(): Promise<CourseListItem[]> {
  const payload = await requestJson<CourseListItem[] | { courses?: CourseListItem[] }>("/api/courses");
  return unwrapCourses(payload);
}

export async function getCourse(courseId: string): Promise<CourseState> {
  return requestJson<CourseState>(`/api/courses/${encodeURIComponent(courseId)}`);
}

export async function uploadCourse(file: File): Promise<{ course_id: string }> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const payload = await requestJson<CourseListItem | CourseState | { course_id?: string }>(
      "/api/courses/upload",
      {
        method: "POST",
        body: formData,
      },
    );
    const courseId = getCourseId(payload);
    if (!courseId) throw new ApiError("Upload response did not include course_id");
    return { course_id: courseId };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const payload = await requestJson<CourseListItem | CourseState | { course_id?: string }>("/api/courses", {
        method: "POST",
        body: formData,
      });
      const courseId = getCourseId(payload);
      if (!courseId) throw new ApiError("Upload response did not include course_id");
      return { course_id: courseId };
    }
    throw error;
  }
}

export function subscribeCourseEvents(
  courseId: string,
  onEvent: (event: StatusEvent) => void,
  onError: (error: Event) => void,
): EventSource {
  const source = new EventSource(`${API_BASE_URL}/api/courses/${encodeURIComponent(courseId)}/events`);
  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as StatusEvent);
    } catch {
      onEvent({
        course_id: courseId,
        stage: "unknown",
        stage_status: "running",
        message: message.data,
      });
    }
  };
  source.onerror = onError;
  return source;
}

export async function requestExport(
  courseId: string,
  payload: { version: string; sections: string[]; format: string },
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/courses/${encodeURIComponent(courseId)}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ApiError(`Export failed: ${response.status} ${response.statusText}`, response.status);
  }

  return response.blob();
}
