/**
 * CYPHER-MD ID GENERATOR
 * Generates a random alphanumeric ID of a given length.
 */

function makeid(length = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

module.exports = { makeid };