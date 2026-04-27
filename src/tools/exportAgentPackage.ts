import {
  generateAgentScript,
  generateBundleMetadataXml,
  generateReadme,
  generateMarkdownSpec,
  generateExportManifest,
} from '../lib/agentScriptGenerator.js';
import type { AgentFormData } from '../types/agent.js';

export interface ExportPackage {
  agentScript: string;
  bundleMetadataXml: string;
  readme: string;
  markdownSpec: string;
  formDataJson: string;
  exportManifestJson: string;
  agentName: string;
}

export const exportAgentPackageTool = {
  name: 'export_agent_package',
  description:
    'Generate the complete export package for an Agentforce agent. ' +
    'Returns all file contents (Agent Script, bundle metadata XML, README, markdown spec, ' +
    'form data JSON, and export manifest) as strings. ' +
    'Write these to the appropriate paths to produce a deployment-ready package:\n' +
    '  .agentforce/exports/{agentName}/{agentName}.agent\n' +
    '  .agentforce/exports/{agentName}/{agentName}.bundle-meta.xml\n' +
    '  .agentforce/exports/{agentName}/README.md\n' +
    '  .agentforce/exports/{agentName}/documentation/agent-specification.md\n' +
    '  .agentforce/exports/{agentName}/metadata/form-data.json\n' +
    '  .agentforce/exports/{agentName}/metadata/export-manifest.json',
  inputSchema: {
    type: 'object' as const,
    properties: {
      formData: {
        type: 'object',
        description: 'The complete agent definition (AgentFormData).',
      },
    },
    required: ['formData'],
  },
  handler(args: { formData: AgentFormData }): ExportPackage {
    const { formData } = args;
    return {
      agentName: formData.config.developer_name,
      agentScript: generateAgentScript(formData),
      bundleMetadataXml: generateBundleMetadataXml(formData),
      readme: generateReadme(formData),
      markdownSpec: generateMarkdownSpec(formData),
      formDataJson: JSON.stringify(formData, null, 2),
      exportManifestJson: JSON.stringify(generateExportManifest(formData), null, 2),
    };
  },
};
