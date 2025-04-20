//backend/middleware/role.js
const role = (requiredRole) => {
    return (req, res, next) => {
      if (req.user.role !== requiredRole) {
        return res.status(403).send({ error: 'Access denied.' });
      }
      next();
    };
  };
  
  module.exports = role;
