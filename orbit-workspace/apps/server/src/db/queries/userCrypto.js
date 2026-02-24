export const userCryptoQueries = {
  create: `
    INSERT INTO user_crypto (user_id, salt, encrypted_master_key, recovery_blob, kdf_params)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING user_id, salt, encrypted_master_key, key_version, kdf_params, created_at
  `,

  findByUserId: `
    SELECT user_id, salt, encrypted_master_key, recovery_blob, key_version, kdf_params
    FROM user_crypto WHERE user_id = $1
  `,

  // Returns crypto material for login (no recovery_blob — that's a separate flow)
  findForLogin: `
    SELECT salt, encrypted_master_key, kdf_params
    FROM user_crypto WHERE user_id = $1
  `,

  // Returns recovery data — generic response, no user enumeration
  findRecoveryByEmail: `
    SELECT uc.recovery_blob, uc.salt, uc.kdf_params
    FROM user_crypto uc
    JOIN users u ON u.id = uc.user_id
    WHERE u.email = $1 AND u.status = 'active'
  `,

  updatePasswordCrypto: `
    UPDATE user_crypto
    SET salt = $2, encrypted_master_key = $3, kdf_params = $4,
        key_version = key_version + 1, updated_at = NOW()
    WHERE user_id = $1
  `,
};
