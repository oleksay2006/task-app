export default interface IUser {
  name?: string;
  password: string;
  age: number;
  email: string;
  tokens: Array<{ token: string }>;
  avatar?: Buffer | null;
  tasks?: Array<{ description: string; completed: boolean }>;
}
