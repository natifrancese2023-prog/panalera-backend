const jwt = require("jsonwebtoken");

const token = jwt.sign(
  { id: 1, rol: "dueno" },
  "PaNaLeRa!2026$ClaveSegura",
  { expiresIn: "365d" }
);

console.log(token);
