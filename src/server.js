import app from "./app.js";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing — copy .env.example to .env");

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Al Qaswa API on http://localhost:${port}`));
