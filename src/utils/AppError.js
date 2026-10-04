export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const notFound = (what = "Resource") => new AppError(`${what} not found`, 404);
