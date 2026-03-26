import { validateImageUrl, validateJsonSchema } from './validation';
import { ValidationError } from '@tkhtechinc/domain-errors';

describe('validateImageUrl', () => {
  describe('valid URLs', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(() => validateImageUrl('https://example.com/image.png')).not.toThrow();
      expect(() => validateImageUrl('https://cdn.example.com/path/to/image.jpg')).not.toThrow();
    });
  });

  describe('SSRF protection', () => {
    it('should block localhost', () => {
      expect(() => validateImageUrl('https://localhost/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://localhost/image.png')).toThrow(/private network/);
    });

    it('should block 127.0.0.1', () => {
      expect(() => validateImageUrl('https://127.0.0.1/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://127.0.0.1:8080/image.png')).toThrow(/private network/);
    });

    it('should block 0.0.0.0', () => {
      expect(() => validateImageUrl('https://0.0.0.0/image.png')).toThrow(ValidationError);
    });

    it('should block AWS metadata endpoint', () => {
      expect(() => validateImageUrl('https://169.254.169.254/latest/meta-data')).toThrow(
        ValidationError
      );
      expect(() => validateImageUrl('https://169.254.169.254/latest/meta-data')).toThrow(
        /private network/
      );
    });

    it('should block private IP ranges (10.x)', () => {
      expect(() => validateImageUrl('https://10.0.0.1/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://10.255.255.255/image.png')).toThrow(ValidationError);
    });

    it('should block private IP ranges (172.16.x - 172.31.x)', () => {
      expect(() => validateImageUrl('https://172.16.0.1/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://172.31.255.255/image.png')).toThrow(ValidationError);
    });

    it('should block private IP ranges (192.168.x)', () => {
      expect(() => validateImageUrl('https://192.168.0.1/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://192.168.1.1/image.png')).toThrow(ValidationError);
    });

    it('should block IPv6 localhost', () => {
      expect(() => validateImageUrl('https://[::1]/image.png')).toThrow(ValidationError);
    });

    it('should block IPv6 private ranges', () => {
      expect(() => validateImageUrl('https://[fc00::1]/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://[fe80::1]/image.png')).toThrow(ValidationError);
    });
  });

  describe('protocol validation', () => {
    it('should reject HTTP (require HTTPS)', () => {
      expect(() => validateImageUrl('http://example.com/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('http://example.com/image.png')).toThrow(/HTTPS/);
    });

    it('should reject file:// protocol', () => {
      expect(() => validateImageUrl('file:///etc/passwd')).toThrow(ValidationError);
    });

    it('should reject ftp:// protocol', () => {
      expect(() => validateImageUrl('ftp://example.com/image.png')).toThrow(ValidationError);
    });
  });

  describe('credentials validation', () => {
    it('should reject URLs with username', () => {
      expect(() => validateImageUrl('https://user@example.com/image.png')).toThrow(ValidationError);
      expect(() => validateImageUrl('https://user@example.com/image.png')).toThrow(/credentials/);
    });

    it('should reject URLs with username and password', () => {
      expect(() => validateImageUrl('https://user:pass@example.com/image.png')).toThrow(
        ValidationError
      );
    });
  });

  describe('invalid input', () => {
    it('should reject empty string', () => {
      expect(() => validateImageUrl('')).toThrow(ValidationError);
    });

    it('should reject malformed URLs', () => {
      expect(() => validateImageUrl('not-a-url')).toThrow(ValidationError);
      expect(() => validateImageUrl('not-a-url')).toThrow(/Invalid image URL format/);
    });
  });
});

describe('validateJsonSchema', () => {
  it('should accept valid objects', () => {
    expect(() => validateJsonSchema({ type: 'object' })).not.toThrow();
    expect(() => validateJsonSchema({ properties: { name: { type: 'string' } } })).not.toThrow();
  });

  it('should reject null', () => {
    expect(() => validateJsonSchema(null)).toThrow(ValidationError);
  });

  it('should reject undefined', () => {
    expect(() => validateJsonSchema(undefined)).toThrow(ValidationError);
  });

  it('should reject arrays', () => {
    expect(() => validateJsonSchema([])).toThrow(ValidationError);
  });

  it('should reject primitives', () => {
    expect(() => validateJsonSchema('string')).toThrow(ValidationError);
    expect(() => validateJsonSchema(123)).toThrow(ValidationError);
    expect(() => validateJsonSchema(true)).toThrow(ValidationError);
  });
});
