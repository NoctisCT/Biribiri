package com.retro.builderpro;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public final class BuilderProRoomBackupSecurity
{
    public static final int ITERATIONS = 120000;
    private static final int SALT_BYTES = 16;
    private static final int HASH_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    private BuilderProRoomBackupSecurity()
    {
    }

    public static boolean validPin(String pin)
    {
        if(pin == null || pin.length() < 6 || pin.length() > 12)
        {
            return false;
        }

        for(int index = 0; index < pin.length(); index++)
        {
            if(!Character.isDigit(pin.charAt(index)))
            {
                return false;
            }
        }

        return true;
    }

    public static Credentials create(String pin)
            throws Exception
    {
        if(!validPin(pin))
        {
            throw new IllegalArgumentException(
                    "El PIN debe tener entre 6 y 12 digitos."
            );
        }

        byte[] salt = new byte[SALT_BYTES];
        RANDOM.nextBytes(salt);

        return new Credentials(
                Base64.getEncoder().encodeToString(salt),
                hash(pin, salt, ITERATIONS),
                ITERATIONS
        );
    }

    public static boolean verify(
            String pin,
            String saltBase64,
            String hashBase64,
            int iterations)
            throws Exception
    {
        if(pin == null || saltBase64 == null || hashBase64 == null)
        {
            return false;
        }

        byte[] salt = Base64.getDecoder().decode(saltBase64);
        byte[] expected = Base64.getDecoder().decode(hashBase64);
        byte[] actual = Base64.getDecoder().decode(
                hash(pin, salt, iterations)
        );

        return MessageDigest.isEqual(expected, actual);
    }

    private static String hash(
            String pin,
            byte[] salt,
            int iterations)
            throws Exception
    {
        PBEKeySpec spec =
                new PBEKeySpec(
                        pin.toCharArray(),
                        salt,
                        iterations,
                        HASH_BITS
                );

        try
        {
            SecretKeyFactory factory =
                    SecretKeyFactory.getInstance(
                            "PBKDF2WithHmacSHA256"
                    );

            return Base64.getEncoder().encodeToString(
                    factory.generateSecret(spec).getEncoded()
            );
        }
        finally
        {
            spec.clearPassword();
        }
    }

    public static final class Credentials
    {
        public final String salt;
        public final String hash;
        public final int iterations;

        public Credentials(
                String salt,
                String hash,
                int iterations)
        {
            this.salt = salt;
            this.hash = hash;
            this.iterations = iterations;
        }
    }
}
