const handleError = (res, status, message) => res.status(status).json({ message });

module.exports = { handleError };