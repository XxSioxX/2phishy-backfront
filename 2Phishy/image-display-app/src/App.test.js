import { render, screen } from '@testing-library/react';

test('test environment renders application markup', () => {
  render(<main>Phishy test harness</main>);
  expect(screen.getByText(/phishy test harness/i)).toBeInTheDocument();
});
