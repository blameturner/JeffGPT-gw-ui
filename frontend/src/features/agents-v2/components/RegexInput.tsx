import { useMemo, useState } from 'react';
import { Field, TextInput } from '../../connectors/components/Field';

export function RegexInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [testUrl, setTestUrl] = useState('');

  const result = useMemo<{ ok: boolean; msg: string } | null>(() => {
    if (!value || !testUrl) return null;
    try {
      const re = new RegExp(value);
      return re.test(testUrl)
        ? { ok: true, msg: '✓ matches' }
        : { ok: false, msg: '✗ no match' };
    } catch {
      return { ok: false, msg: 'Invalid regex' };
    }
  }, [value, testUrl]);

  return (
    <div className="space-y-2">
      <TextInput
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '^https://api\\.example\\.com/'}
        className="font-mono"
      />
      <Field label="Test URL" hint="Paste a URL to check whether it matches the regex.">
        <TextInput
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          placeholder="https://api.example.com/v1/foo"
          className="font-mono"
        />
      </Field>
      {result && (
        <div className={`text-xs font-mono ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {result.msg}
        </div>
      )}
    </div>
  );
}
