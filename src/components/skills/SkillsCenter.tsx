import React from 'react';
import { useSkillsStore, SkillInfo } from '../../stores/skills-store';
import { useAppStore } from '../../stores/app-store';
import { useContextStore } from '../../stores/context-store';
import { getSkillCnMeta, scoreSkillForContext } from '../../utils/skill-cn';

const zh = {
  skills: '\u6280\u80fd',
  search: '\u641c\u7d22',
  searchMore: '\u5728 skills.sh \u641c\u7d22\u66f4\u591a skills',
  placeholder: '\u641c\u7d22\u6280\u80fd\uff1a\u524d\u7aef / PDF / \u8bba\u6587 / \u7edf\u8ba1 / GitHub...',
  scanning: '\u6b63\u5728\u626b\u63cf skills...',
  recommended: '\u667a\u80fd\u63a8\u8350',
  noMatchPrefix: '\u6ca1\u6709\u5339\u914d',
  noMatchSuffix: '\u7684\u672c\u5730\u6280\u80fd\u3002',
  searchSkillsSh: '\u53bb skills.sh \u641c\u7d22',
  noSkills: '\u8fd8\u6ca1\u6709\u5b89\u88c5 skills\u3002',
  noEnglishDesc: '\u6682\u65e0\u82f1\u6587\u8bf4\u660e',
  use: '\u4f7f\u7528',
  copy: '\u590d\u5236',
  open: '\u6253\u5f00',
  useTitle: '\u76f4\u63a5\u63d2\u5165\u5230\u5f53\u524d\u5f15\u64ce\u8f93\u5165',
  copyTitle: '\u590d\u5236 /skill-name',
  openTitle: '\u6253\u5f00 skill \u6587\u4ef6\u5939',
  manualOnly: '\u4ec5\u624b\u52a8\u8c03\u7528',
  hasScripts: '\u542b\u811a\u672c',
};

const en: typeof zh = {
  skills: 'Skills',
  search: 'Search',
  searchMore: 'Search more skills on skills.sh',
  placeholder: 'Search skills: frontend / PDF / papers / stats / GitHub...',
  scanning: 'Scanning skills...',
  recommended: 'Recommended',
  noMatchPrefix: 'No local skills match',
  noMatchSuffix: '.',
  searchSkillsSh: 'Search skills.sh',
  noSkills: 'No skills installed yet.',
  noEnglishDesc: 'No description',
  use: 'Use',
  copy: 'Copy',
  open: 'Open',
  useTitle: 'Insert into the current engine input',
  copyTitle: 'Copy /skill-name',
  openTitle: 'Open skill folder',
  manualOnly: 'Manual only',
  hasScripts: 'Has scripts',
};

export const SkillsCenter: React.FC<{ visible: boolean }> = ({ visible }) => {
  const {
    skills,
    loading,
    loaded,
    loadedProjectPath,
    error,
    searchQuery,
    selectedSkill,
    setSearchQuery,
    selectSkill,
    recordSkillUse,
    usageCounts,
    filteredSkills,
  } = useSkillsStore();

  const { currentProjectPath, terminalOutput, lastDetectedError, language } = useAppStore();
  const { projectContext } = useContextStore();
  const text = language === 'zh' ? zh : en;
  const currentSkillsReady = loaded && loadedProjectPath === (currentProjectPath || undefined);

  const recommendationContext = [
    currentProjectPath || '',
    projectContext?.markers.join(' ') || '',
    projectContext?.scripts.map((script) => `${script.name} ${script.command}`).join(' ') || '',
    terminalOutput.slice(-2500),
    lastDetectedError || '',
  ].join('\n');

  const scoredSkills = (currentSkillsReady ? filteredSkills() : [])
    .map((skill) => ({
      skill,
      score: scoreSkillForContext(skill, recommendationContext, usageCounts[skill.name] || 0),
    }))
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
  const recommendedSkills = scoredSkills.filter((item) => item.score > 0).slice(0, 5);
  const displaySkills = scoredSkills.map((item) => item.skill);

  const handleUseSkill = (skill: SkillInfo) => {
    const command = `/${skill.name} `;
    recordSkillUse(skill.name);
    window.ccodex.terminalInput(command);
    navigator.clipboard.writeText(command.trim()).catch(() => {});
  };

  const handleCopySkill = (skill: SkillInfo) => {
    navigator.clipboard.writeText(`/${skill.name}`).catch(() => {});
  };

  const handleOpenSkillsSh = () => {
    window.ccodex.openExternal(`https://skills.sh/?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleOpenSkillFolder = (skill: SkillInfo) => {
    window.ccodex.openExternal(`file://${skill.path}`);
  };

  const scopeLabel = (scope: string) => {
    if (scope === 'global') return 'G';
    if (scope === 'project') return 'P';
    return '?';
  };

  const originLabel = (skill: SkillInfo) => {
    if (skill.origin === 'codex') return 'X';
    if (skill.origin === 'agents') return 'AG';
    if (skill.origin === 'project') return 'P';
    if (skill.origin === 'claude') return 'C';
    return scopeLabel(skill.scope);
  };

  return (
    <div className={`skills-panel ${!visible ? 'hidden' : ''}`}>
      <div className="skills-panel__header">
        <span>{text.skills} ({currentSkillsReady ? skills.length : 0})</span>
        <button className="skill-item__action-btn" onClick={handleOpenSkillsSh} title={text.searchMore}>
          + {text.search}
        </button>
      </div>

      <div className="skills-panel__search">
        <input
          type="text"
          placeholder={text.placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="skills-panel__list">
        {(loading || !currentSkillsReady) && <SkillsListSkeleton label={text.scanning} />}

        {currentSkillsReady && !loading && recommendedSkills.length > 0 && (
          <div className="skill-recommendations">
            <div className="skill-recommendations__title">{text.recommended}</div>
            {recommendedSkills.map(({ skill }) => {
              const cn = getSkillCnMeta(skill);
              return (
                <button
                  key={`rec:${skill.scope}:${skill.name}`}
                  className="skill-recommendation"
                  onClick={() => handleUseSkill(skill)}
                  title={`${text.use} /${skill.name}`}
                >
                  <span>/{skill.name}</span>
                  <small>{language === 'zh' ? cn.title : skill.description || skill.name}</small>
                </button>
              );
            })}
          </div>
        )}

        {currentSkillsReady && !loading && displaySkills.length === 0 && (
          <div style={{ padding: '16px 12px', color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center' }}>
            {searchQuery ? (
              <>
                {text.noMatchPrefix} "{searchQuery}"{text.noMatchSuffix}
                <br /><br />
                <button className="skill-item__action-btn" onClick={handleOpenSkillsSh}>
                  {text.searchSkillsSh}
                </button>
              </>
            ) : (
              text.noSkills
            )}
          </div>
        )}

        {currentSkillsReady && displaySkills.map((skill) => {
          const cn = getSkillCnMeta(skill);
          return (
            <div
              key={`${skill.scope}:${skill.name}`}
              className={`skill-item ${selectedSkill?.name === skill.name && selectedSkill?.scope === skill.scope ? 'selected' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', `/${skill.name} `);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDoubleClick={() => handleUseSkill(skill)}
              onClick={() => selectSkill(
                selectedSkill?.name === skill.name && selectedSkill?.scope === skill.scope ? null : skill
              )}
            >
              <div className="skill-item__header">
                <span className="skill-item__name">/{skill.name}</span>
                <span className="skill-item__scope" title={skill.origin || skill.scope}>{originLabel(skill)}</span>
              </div>
              <div className="skill-item__cn-title">{language === 'zh' ? cn.title : skill.name}</div>
              <div className="skill-item__cn-hint">{language === 'zh' ? cn.hint : skill.description || text.noEnglishDesc}</div>
              <div className="skill-item__desc">{language === 'zh' ? skill.description || text.noEnglishDesc : skill.scope}</div>
              <div className="skill-item__actions">
                <button className="skill-item__action-btn skill-item__action-btn--primary" onClick={(e) => {
                  e.stopPropagation();
                  handleUseSkill(skill);
                }} title={text.useTitle}>
                  {text.use}
                </button>
                <button className="skill-item__action-btn" onClick={(e) => {
                  e.stopPropagation();
                  handleCopySkill(skill);
                }} title={text.copyTitle}>
                  {text.copy}
                </button>
                <button className="skill-item__action-btn" onClick={(e) => {
                  e.stopPropagation();
                  handleOpenSkillFolder(skill);
                }} title={text.openTitle}>
                  {text.open}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedSkill && (
        <div className="skill-detail">
          <div className="skill-detail__cn-title">
            {language === 'zh' ? getSkillCnMeta(selectedSkill).title : selectedSkill.name}
          </div>
          <div className="skill-detail__cn-hint">
            {language === 'zh' ? getSkillCnMeta(selectedSkill).hint : selectedSkill.description || text.noEnglishDesc}
          </div>
          <div className="skill-detail__name">/{selectedSkill.name}</div>
          <div className="skill-detail__desc">{selectedSkill.description || text.noEnglishDesc}</div>
          <div className="skill-detail__meta">
            <span className="skill-detail__tag">{selectedSkill.scope}</span>
            {selectedSkill.argumentHint && <span className="skill-detail__tag">args: {selectedSkill.argumentHint}</span>}
            {selectedSkill.allowedTools && selectedSkill.allowedTools.length > 0 && (
              <span className="skill-detail__tag">tools: {selectedSkill.allowedTools.join(', ')}</span>
            )}
            {selectedSkill.disableModelInvocation && (
              <span className="skill-detail__tag skill-detail__tag--warn">{text.manualOnly}</span>
            )}
            {selectedSkill.hasScripts && (
              <span className="skill-detail__tag skill-detail__tag--warn">{text.hasScripts}</span>
            )}
          </div>
          <button className="skill-detail__insert-btn" onClick={() => handleUseSkill(selectedSkill)}>
            {text.use} /{selectedSkill.name}
          </button>
        </div>
      )}
    </div>
  );
};

const SkillsListSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div className="skills-skeleton-list" aria-label={label}>
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="skill-item skill-item--skeleton">
        <div className="skeleton-line skeleton-line--medium" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--wide" />
        <div className="skill-item__actions">
          <div className="skeleton-button skeleton-button--small" />
          <div className="skeleton-button skeleton-button--small" />
        </div>
      </div>
    ))}
  </div>
);
