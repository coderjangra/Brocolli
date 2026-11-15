import { useMemo } from 'react';

import { netBalances, netBetween, type PersonPair } from '@/domain/balances';
import type { Paise, PersonId } from '@/domain/types';

import { ME, type Person } from './types';
import { useStore } from './useStore';

/** Pairwise INR balances across everything (deleted rows are skipped by the engine). */
export function useNets(): Map<PersonPair, Paise> {
  const expenses = useStore((s) => s.expenses);
  const settlements = useStore((s) => s.settlements);
  return useMemo(() => netBalances(expenses, settlements, 'INR'), [expenses, settlements]);
}

export interface FriendBalance {
  person: Person;
  /** > 0: they owe me. < 0: I owe them. */
  net: Paise;
}

export function useFriendBalances(): {
  friends: FriendBalance[];
  owedToMe: Paise;
  iOwe: Paise;
} {
  const people = useStore((s) => s.people);
  const nets = useNets();
  return useMemo(() => {
    const friends = people
      .map((person) => ({ person, net: netBetween(nets, ME, person.id) }))
      .sort(
        (a, b) => Math.abs(b.net) - Math.abs(a.net) || a.person.name.localeCompare(b.person.name),
      );
    let owedToMe = 0;
    let iOwe = 0;
    for (const { net } of friends) {
      if (net > 0) owedToMe += net;
      else iOwe -= net;
    }
    return { friends, owedToMe, iOwe };
  }, [people, nets]);
}

/** Resolve any person id (including ME) to something displayable. */
export function usePersonLookup(): (id: PersonId) => Person {
  const people = useStore((s) => s.people);
  const myUpi = useStore((s) => s.profile.upiId);
  return useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const me: Person = { id: ME, name: 'You', emoji: '🥦', upiId: myUpi, createdAt: 0 };
    return (id: PersonId) =>
      id === ME ? me : (byId.get(id) ?? { id, name: 'Someone', emoji: '👤', createdAt: 0 });
  }, [people, myUpi]);
}
