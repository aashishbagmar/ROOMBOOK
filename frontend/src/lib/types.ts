export interface User {
  id: string;
  name: string;
  email: string;
  department: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Room {
  id: number;
  name: string;
  capacity: number;
  location: string;
  amenities: string[];
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: number;
  room_id: number;
  organizer_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  recurrence_group_id: string | null;
  created_at: string;
  room?: Room;
  organizer?: User;
  participants?: { id: number; user: User }[];
}

export interface BookingListResponse {
  bookings: Booking[];
  total: number;
}

export interface BookingCreate {
  room_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  participant_ids?: string[];
  is_recurring?: boolean;
  recurring_days?: number[];
  repeat_until?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}
