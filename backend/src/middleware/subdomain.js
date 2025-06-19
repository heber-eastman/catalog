const { GolfCourseInstance } = require('../models');

/**
 * Middleware to extract subdomain from Host header and map to course_id
 * Expected Host: subdomain.devstreet.co
 * Sets req.courseId and req.subdomain for downstream middleware
 */
const mapSubdomainToCourse = async (req, res, next) => {
  try {
    const host = req.get('Host') || req.headers.host;

    if (!host) {
      return res.status(400).json({ error: 'Host header required' });
    }

    // Extract subdomain from host (e.g., "pine-valley.devstreet.co" -> "pine-valley")
    const subdomain = extractSubdomain(host);

    if (!subdomain) {
      return res.status(400).json({ error: 'Invalid subdomain format' });
    }

    // Find course by subdomain
    const course = await GolfCourseInstance.findOne({
      where: { subdomain },
      attributes: ['id', 'name', 'subdomain', 'status'],
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found for subdomain' });
    }

    if (course.status !== 'Active') {
      return res.status(403).json({ error: 'Course is not active' });
    }

    // Set course info on request for downstream middleware
    req.courseId = course.id;
    req.subdomain = subdomain;
    req.courseInfo = {
      id: course.id,
      name: course.name,
      subdomain: course.subdomain,
      status: course.status,
    };

    next();
  } catch (error) {
    console.error('Subdomain mapping error:', error);
    res.status(500).json({ error: 'Failed to map subdomain to course' });
  }
};

/**
 * Extract subdomain from host header
 * Supports formats:
 * - subdomain.devstreet.co -> subdomain
 * - localhost:3000 -> localhost (for development)
 * - subdomain.localhost:3000 -> subdomain (for development)
 */
function extractSubdomain(host) {
  // Remove port if present
  const hostWithoutPort = host.split(':')[0];

  // Handle localhost for development
  if (hostWithoutPort === 'localhost') {
    return 'localhost';
  }

  // Handle subdomain.localhost for development
  if (hostWithoutPort.endsWith('.localhost')) {
    const parts = hostWithoutPort.split('.');
    return parts.length >= 2 ? parts[0] : null;
  }

  // Handle production format: subdomain.devstreet.co
  if (hostWithoutPort.endsWith('.devstreet.co')) {
    const parts = hostWithoutPort.split('.');
    return parts.length >= 3 ? parts[0] : null;
  }

  // For other domains or invalid formats
  return null;
}

/**
 * Optional middleware for routes that should work without subdomain validation
 * (e.g., health checks, general signup)
 */
const extractSubdomainOptional = (req, res, next) => {
  const host = req.get('Host') || req.headers.host;

  if (host) {
    const subdomain = extractSubdomain(host);
    req.subdomain = subdomain;
  }

  next();
};

module.exports = {
  mapSubdomainToCourse,
  extractSubdomainOptional,
  extractSubdomain, // Export for testing
};
