import { UserType } from "../schemas";

// Mock user list data for demonstrating full pagination, sorting, selection
let mockUsers: UserType[] = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", role: "ADMIN", status: "ACTIVE" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "MANAGER", status: "ACTIVE" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", role: "USER", status: "ACTIVE" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", role: "USER", status: "INACTIVE" },
  { id: "5", name: "Edward Nygma", email: "edward@example.com", role: "USER", status: "ACTIVE" },
  { id: "6", name: "Fiona Gallagher", email: "fiona@example.com", role: "MANAGER", status: "ACTIVE" },
  { id: "7", name: "George Stark", email: "george@example.com", role: "USER", status: "ACTIVE" },
  { id: "8", name: "Hannah Abbott", email: "hannah@example.com", role: "USER", status: "INACTIVE" },
];

export const userService = {
  getAll: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    sortField?: string;
    sortDir?: string;
  }): Promise<{ data: UserType[]; totalCount: number }> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    let filtered = [...mockUsers];

    // Search filter
    if (params?.search) {
      const query = params.search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
      );
    }

    // Sort processing
    if (params?.sortField) {
      const field = params.sortField as keyof UserType;
      const desc = params.sortDir === "desc";
      filtered.sort((a, b) => {
        if (a[field] < b[field]) return desc ? 1 : -1;
        if (a[field] > b[field]) return desc ? -1 : 1;
        return 0;
      });
    }

    // Pagination
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      totalCount: filtered.length,
    };
  },

  create: async (data: Omit<UserType, "id">): Promise<UserType> => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const newUser = { ...data, id: String(mockUsers.length + 1) };
    mockUsers.unshift(newUser);
    return newUser;
  },

  delete: async (id: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    mockUsers = mockUsers.filter((u) => u.id !== id);
  },
};
