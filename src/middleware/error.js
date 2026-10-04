export function notFoundRoute(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Something went wrong";

  if (err.name === "CastError") (status = 400), (message = `Invalid ${err.path}`);
  if (err.name === "ValidationError") (status = 422), (message = Object.values(err.errors)[0].message);
  if (err.code === 11000) (status = 409), (message = `${Object.keys(err.keyValue)[0]} already exists`);
  if (err.name === "MulterError") status = 400;

  if (status >= 500) console.error(err);
  res.status(status).json({ message });
}
