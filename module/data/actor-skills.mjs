// Compatibility stub: some previous versions might import this module.
// Current code path uses actor-sheet skillList generation.

export function prepareSkills(skills = {}, actorType = 'npc') {
  const npcSkillKeys = [
    'atletismo', 'sigilo', 'juegoManos', 'acrobacias',
    'tratoAnimales', 'percepcion', 'perspicacia', 'supervivencia',
    'persuasion', 'enganar', 'interpretacion', 'intimidacion'
  ];

  const abilityMapping = {
    atletismo: 'VIG', sigilo: 'AGIL', juegoManos: 'AGIL', acrobacias: 'AGIL',
    investigacion: 'MENT', artesania: 'MENT', historia: 'MENT', religion: 'MENT',
    aether: 'MENT', naturaleza: 'MENT', medicina: 'MENT',
    tratoAnimales: 'INST', percepcion: 'INST', perspicacia: 'INST', supervivencia: 'INST',
    persuasion: 'PRE', enganar: 'PRE', interpretacion: 'PRE', intimidacion: 'PRE'
  };

  const keys = actorType === 'npc' ? npcSkillKeys : Object.keys(skills);

  return keys
    .filter((key) => Object.prototype.hasOwnProperty.call(skills, key))
    .map((key) => {
      const skill = skills[key] || {};
      const rank = Number(skill.rank) || 0;
      const bonus = Number(skill.bonus) || 0;
      return {
        key,
        label: skill.label || key,
        ability: abilityMapping[key] || '-',
        rank,
        bonus,
        total: rank + bonus
      };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
}
