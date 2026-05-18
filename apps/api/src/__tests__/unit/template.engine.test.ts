import { renderTemplate } from '@/modules/notifications/template.engine';

describe('Template engine — renderTemplate', () => {

  it('replaces single variable', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'Ahmad' });
    expect(result).toBe('Hello Ahmad!');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate(
      'Dear {{name}}, your appointment is on {{date}} at {{time}}.',
      { name: 'Fatima', date: '2024-03-15', time: '09:00' },
    );
    expect(result).toBe('Dear Fatima, your appointment is on 2024-03-15 at 09:00.');
  });

  it('leaves unknown variables as-is', () => {
    const result = renderTemplate('Token: {{token}}', {});
    expect(result).toBe('Token: {{token}}');
  });

  it('replaces same variable multiple times', () => {
    const result = renderTemplate('{{name}} is here. Hello {{name}}!', { name: 'Omar' });
    expect(result).toBe('Omar is here. Hello Omar!');
  });

  it('handles empty template', () => {
    const result = renderTemplate('', { name: 'test' });
    expect(result).toBe('');
  });

  it('handles template with no variables', () => {
    const result = renderTemplate('No variables here.', { name: 'unused' });
    expect(result).toBe('No variables here.');
  });

  it('handles Arabic/Farsi content in variables', () => {
    const result = renderTemplate('سلام {{name}} عزیز', { name: 'احمد' });
    expect(result).toBe('سلام احمد عزیز');
  });

});
