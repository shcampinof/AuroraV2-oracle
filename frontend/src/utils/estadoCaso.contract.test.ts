import { describe, expect, it } from 'vitest';
import contract from '../../../shared/estado-caso-scenarios.v1.json';
import { deriveEstadoTramiteAurora } from '../config/formRules.aurora';
import { deriveStatusCeleste } from '../config/formRules.celeste';
import { evaluateAuroraRules } from './evaluateAuroraRules';
import { evaluateCelesteRules } from './evaluateCelesteRules';

type Scenario = {
  id: string;
  flow: 'aurora' | 'celeste';
  answers: Record<string, unknown>;
  expectedCode: string;
  expectedLabel: string;
};

const scenarios = contract.scenarios as Scenario[];

describe('contrato compartido de estados', () => {
  it.each(scenarios)('$id produce $expectedCode', (scenario) => {
    if (scenario.flow === 'aurora') {
      expect(evaluateAuroraRules({ answers: scenario.answers }).derivedStatus).toBe(scenario.expectedLabel);
      expect(deriveEstadoTramiteAurora(scenario.answers)).toBe(scenario.expectedLabel);
      return;
    }

    expect(evaluateCelesteRules({ answers: scenario.answers }).derivedStatus).toBe(scenario.expectedLabel);
    expect(deriveStatusCeleste(scenario.answers)).toBe(scenario.expectedLabel);
  });
});
