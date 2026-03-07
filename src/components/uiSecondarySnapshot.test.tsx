/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import CategoryBadge from './CategoryBadge';
import IconButton from './IconButton';
import { Plus } from 'lucide-react';

describe('UI secondary components snapshots', () => {
  it('CategoryBadge renders label and color', () => {
    const { container } = render(
      <CategoryBadge label="Alimentação" color="var(--color-expense)" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('IconButton renders variants and sizes', () => {
    const { container } = render(
      <div>
        <IconButton icon={<Plus />} size="sm" variant="neutral" label="Adicionar" />
        <IconButton icon={<Plus />} size="md" variant="danger" label="Excluir" />
        <IconButton icon={<Plus />} size="lg" variant="success" label="Salvar" />
      </div>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
