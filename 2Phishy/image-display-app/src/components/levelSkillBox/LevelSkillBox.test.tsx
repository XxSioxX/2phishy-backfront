import { fireEvent, render, screen, within } from '@testing-library/react';
import LevelSkillBox from './LevelSkillBox';

const levelSkillData = {
  average_score: 82,
  users_count: 3,
  total_users: 4,
  metrics_used: [
    'question accuracy',
    'level-specific gameplay events',
    'zone/room progress',
    'level completion',
  ],
  info: 'Average Level Skill Score combines quiz answers with each level gameplay mechanics.',
  levels: [
    {
      topic: 'Safe Browsing Practices',
      label: 'Safe Browsing',
      average_score: 86,
      users_count: 2,
      total_users: 4,
      metrics_used: ['question accuracy', 'trap hits'],
      info: 'Safe Browsing weighs quiz accuracy and traps.',
      categories: [
        {
          key: 'strong',
          label: 'Strong',
          range: '80-100%',
          color: '#4CAF50',
          count: 2,
          users: [
            {
              userid: 'user-1',
              username: 'Alice',
              email: 'alice@example.com',
              avatar_url: 'https://example.com/a.png',
              score: 91,
              details: { correct_answers: 3, total_questions: 3, gameplay: {} },
            },
            {
              userid: 'user-2',
              username: 'Bob',
              email: 'bob@example.com',
              avatar_url: 'https://example.com/b.png',
              score: 84,
              details: { correct_answers: 2, total_questions: 3, gameplay: {} },
            },
          ],
        },
        {
          key: 'needs_practice',
          label: 'Needs Practice',
          range: '0-59%',
          color: '#E57373',
          count: 0,
          users: [],
        },
      ],
    },
  ],
};

describe('LevelSkillBox', () => {
  it('renders the compact average score and level preview', () => {
    render(<LevelSkillBox data={levelSkillData as any} />);

    expect(screen.getByText('Average Level Skill Score')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('Safe Browsing')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
  });

  it('opens the expanded level breakdown', () => {
    render(<LevelSkillBox data={levelSkillData as any} />);

    fireEvent.click(screen.getByRole('button', { name: /expand/i }));

    expect(screen.getByRole('heading', { name: /level skill performance/i })).toBeInTheDocument();
    expect(screen.getByText(/86% average from 2 of 4 users/i)).toBeInTheDocument();

    const strongCategory = screen.getByRole('button', { name: /strong/i });
    expect(within(strongCategory).getByText('2 users')).toBeInTheDocument();
  });
});
