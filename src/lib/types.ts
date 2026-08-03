export type UserRole = 'super_admin' | 'admin' | 'manager' | 'staff';
export type TaskType = 'task' | 'checklist';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus =
  | 'open' | 'in_progress' | 'pending_review' | 'completed'
  | 'blocked' | 'overdue' | 'cancelled';

export interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
}

export interface Company {
  id: string;
  name: string;
  slug: string | null;
  accent_color: string | null;
  timezone: string;
  is_active: boolean;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  is_preset: boolean;
}

export interface Task {
  id: string;
  company_id: string;
  department_id: string | null;
  title: string;
  description: string | null;
  type: TaskType;
  created_by: string | null;
  start_at: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  requires_photo: boolean;
  requires_approval: boolean;
  rejection_note: string | null;
  blocked_reason: string | null;
  recurrence_rule: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  position: number;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  requires_photo: boolean;
  note: string | null;
}

export interface Announcement {
  id: string;
  company_id: string;
  department_id: string | null;
  author_id: string | null;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
}

export interface Note {
  id: string;
  author_id: string;
  task_id: string | null;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string | null;
  checklist_item_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  company_id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  type: TaskType;
  default_recurrence: string | null;
  default_priority: TaskPriority;
  requires_photo: boolean;
  requires_approval: boolean;
}
