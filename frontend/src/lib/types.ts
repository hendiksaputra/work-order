export type UserRole = 'admin' | 'planner' | 'mechanic' | 'supervisor' | 'logistic';

export type DelayCause = 'spare_part' | 'manpower' | 'tools' | 'other';

export interface User {
  id: number;
  name: string;
  username?: string;
  email: string;
  employee_id?: string;
  role: UserRole;
  department?: string;
  permissions?: string[];
}

export interface WorkOrder {
  id: number;
  wo_number: string;
  type: 'main' | 'sub';
  parent_id?: number;
  main_category?: 'component' | 'unit' | 'other';
  workshop?: 'rebuild' | 'fabrication' | 'support';
  department?: string;
  title: string;
  description?: string;
  component_name?: string;
  component_serial?: string;
  unit_model?: string;
  unit_number?: string;
  location?: string;
  status: string;
  operational_status?: string | null;
  operational_status_notes?: string | null;
  manpower_count: number;
  estimated_hours: number;
  target_hours?: number;
  actual_hours: number;
  logged_hours_sum?: number;
  material_cost: number;
  work_details?: string;
  supervisor_notes?: string;
  created_by: number;
  creator?: User;
  parent?: WorkOrder;
  sub_work_orders?: WorkOrder[];
  working_activities_count?: number;
  approved_mechanics_count?: number;
  open_mechanics_count?: number;
  mechanic_activities?: MechanicActivity[];
  parts_requests?: PartsRequest[];
  opened_at?: string;
  closed_at?: string;
  delay_cause?: DelayCause | null;
  delay_notes?: string | null;
  component_installed_at?: string | null;
  created_at: string;
}

/** Response WO dari API yang bisa menyertakan pesan sukses. */
export type WorkOrderApiResult = WorkOrder & { message?: string };

export interface ActivityType {
  id: number;
  name: string;
  category: 'productive' | 'non_productive' | 'mechanic_skill';
}

export interface OvertimeRequest {
  id: number;
  user_id: number;
  work_order_id?: number | null;
  activity_date: string;
  overtime_start: string;
  overtime_end: string;
  reason: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  supervisor_notes?: string | null;
  approved_at?: string | null;
  user?: User;
  work_order?: WorkOrder;
  approver?: User;
}

export interface OvertimeRequestStatus {
  standard_work_end: string;
  has_pending: boolean;
  pending: OvertimeRequest | null;
  has_approved: boolean;
  approved: OvertimeRequest | null;
  approved_until: string | null;
}

export interface MechanicActivity {
  id: number;
  user_id: number;
  submission_id?: number;
  work_order_id?: number;
  activity_type_id: number;
  mode: 'working' | 'standby';
  activity_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  notes?: string;
  status: string;
  user?: User;
  work_order?: WorkOrder;
  activity_type?: ActivityType;
  submission?: MechanicActivitySubmission;
}

export interface MechanicActivitySubmission {
  id: number;
  user_id: number;
  activity_date: string;
  status: string;
  activities_count: number;
  total_hours: number;
  submitted_at?: string;
  approved_at?: string;
  supervisor_notes?: string;
  user?: User;
  activities?: MechanicActivity[];
}

export interface PartsRequestItem {
  id?: number;
  part_name: string;
  part_number?: string;
  qty: number;
  unit: string;
  in_stock: boolean;
  is_outstanding?: boolean;
  unit_cost: number;
  notes?: string;
}

export interface PartsRequest {
  id: number;
  request_number: string;
  work_order_id: number;
  workshop: string;
  status: string;
  notes?: string;
  supervisor_notes?: string;
  created_by?: number;
  approved_by?: number;
  logistic_by?: number;
  approved_at?: string;
  creator?: User;
  approver?: User;
  logistic_user?: User;
  work_order?: WorkOrder;
  items: PartsRequestItem[];
  created_at: string;
}

export interface PartsPendingApprovalSummary {
  count: number;
  label?: string;
  by_department?: {
    department: string;
    workshop: string;
    count: number;
    supervisors: string[];
  }[];
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  per_page?: number;
  total_hours_sum?: number;
}

export interface RoleRecord {
  id: number;
  slug: string;
  name: string;
  description?: string;
  is_system: boolean;
  users_count: number;
  permissions: string[];
  permission_details?: { id: number; name: string; label: string; group: string }[];
}

export interface OitmRecord {
  id: number;
  U_MIS_UnitNo: string;
  U_MIS_ModeNo: string;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionCatalogGroup {
  group: string;
  group_label: string;
  permissions: { id: number; name: string; label: string; group: string }[];
}
