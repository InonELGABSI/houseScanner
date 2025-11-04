export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
}

export interface UpdateUserProfile {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}
