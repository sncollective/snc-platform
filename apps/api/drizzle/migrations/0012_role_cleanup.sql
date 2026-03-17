-- Rename cooperative-member to stakeholder
UPDATE user_roles SET role = 'stakeholder' WHERE role = 'cooperative-member';

-- Remove redundant roles (subscriber, creator, service-client)
DELETE FROM user_roles WHERE role IN ('subscriber', 'creator', 'service-client');
