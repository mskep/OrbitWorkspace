import React, { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';

function PermissionGate({ toolId, requiredPermissions, children, fallback }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, [toolId, requiredPermissions]);

  async function checkPermissions() {
    try {
      const result = await hubAPI.permissions.check({
        toolId,
        perms: requiredPermissions
      });
      setHasPermission(result.allowed);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Checking permissions...</div>;
  }

  if (!hasPermission) {
    return fallback || <div className="permission-denied">Access denied</div>;
  }

  return <>{children}</>;
}

export default PermissionGate;
