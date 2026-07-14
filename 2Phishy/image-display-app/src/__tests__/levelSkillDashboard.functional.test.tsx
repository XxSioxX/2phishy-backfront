import { fireEvent, render, screen } from '@testing-library/react';
import LevelSkillBox from '../components/levelSkillBox/LevelSkillBox';

const functionalData = {
  average_score: 71,
  users_count: 2,
  total_users: 3,
  metrics_used: ['question accuracy', 'gameplay events'],
  info: 'Functional test data',
  levels: [
    {
      topic: 'Incident Response',
      label: 'Incident Response',
      average_score: 71,
      users_count: 2,
      total_users: 3,
      metrics_used: ['room completion', 'final shutdown'],
      info: 'Incident Response weighs rooms and final shutdown.',
      categories: [
        {
          key: 'on_track',
          label: 'On Track',
          range: '60-79%',
          color: '#FFB74D',
          count: 2,
          users: [
            {
              userid: 'user-10',
              username: 'Mafunami',
              email: 'mafunami@example.com',
              avatar_url: 'https://example.com/m.png',
              score: 74,
              details: {
                correct_answers: 5,
                total_questions: 7,
                gameplay: { rooms_completed: 4, final_shutdown: 1 },
              },
            },
            {
              userid: 'user-11',
              username: 'Rekit',
              email: 'rekit@example.com',
              avatar_url: 'https://example.com/r.png',
              score: 68,
              details: {
                correct_answers: 4,
                total_questions: 7,
                gameplay: { rooms_completed: 3, final_shutdown: 1 },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('level skill dashboard functional flow', () => {
  it('expands the dashboard card and opens the centered user list window', () => {
    render(<LevelSkillBox data={functionalData as any} />);

    fireEvent.click(screen.getByRole('button', { name: /expand/i }));
    fireEvent.click(screen.getByRole('button', { name: /on track/i }));

    expect(screen.getByText('On Track users')).toBeInTheDocument();
    expect(screen.getByText('Mafunami')).toBeInTheDocument();
    expect(screen.getByText('mafunami@example.com')).toBeInTheDocument();
    expect(screen.getByText('Rekit')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
  });
});
