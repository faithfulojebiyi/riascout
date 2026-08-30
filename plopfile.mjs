/**
 * Scaffolds code that already follows docs/plans + .claude/skills/riascout-module.
 * Run: bun run gen
 */
export default function plopfile(plop) {
  plop.setHelper('isQuery', (t) => t === 'query')
  plop.setHelper('isApi', (a) => a === 'api')

  const featurePrompt = {
    type: 'input',
    name: 'feature',
    message: 'Feature module (dash-case, e.g. prospecting):',
    validate: (v) => /^[a-z][a-z0-9-]*$/.test(v) || 'dash-case, lowercase',
  }

  const appPrompt = {
    type: 'list',
    name: 'app',
    message: 'Which app?',
    choices: ['api', 'worker'],
    default: 'api',
  }

  // full feature module: controller, module, schema, dto + one handler
  plop.setGenerator('feature', {
    description: 'New CQRS feature module (controller, module, schema, dto, first handler)',
    prompts: [
      appPrompt,
      featurePrompt,
      {
        type: 'list',
        name: 'type',
        message: 'First handler:',
        choices: ['query', 'command'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Handler name (dash-case, e.g. get-advisor):',
        validate: (v) => /^[a-z][a-z0-9-]*$/.test(v) || 'dash-case, lowercase',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{feature}}.module.ts',
        templateFile: 'plop-templates/feature/module.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/schema.ts',
        templateFile: 'plop-templates/feature/schema.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/dto/{{feature}}.dto.ts',
        templateFile: 'plop-templates/feature/dto.hbs',
      },
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{feature}}.controller.ts',
        templateFile: 'plop-templates/feature/controller.hbs',
        skip: (d) => (d.app === 'worker' ? 'worker has no controllers' : undefined),
      },
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{#if (isQuery type)}}queries{{else}}commands{{/if}}/{{dashCase name}}.ts',
        templateFile: 'plop-templates/cqrs/handler.hbs',
      },
      {
        type: 'append',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{feature}}.module.ts',
        pattern: /(\/\/ plop:imports)/,
        template:
          "import { {{pascalCase name}}{{pascalCase type}}Handler } from './{{#if (isQuery type)}}queries{{else}}commands{{/if}}/{{dashCase name}}.js'",
      },
      {
        type: 'append',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{feature}}.module.ts',
        pattern: /(\/\/ plop:providers)/,
        template: '    {{pascalCase name}}{{pascalCase type}}Handler,',
      },
    ],
  })

  // add a handler to an existing feature, and register it
  plop.setGenerator('cqrs', {
    description: 'Add a command or query to an existing feature (registers it in the module)',
    prompts: [
      appPrompt,
      featurePrompt,
      { type: 'list', name: 'type', message: 'Type:', choices: ['query', 'command'] },
      {
        type: 'input',
        name: 'name',
        message: 'Handler name (dash-case):',
        validate: (v) => /^[a-z][a-z0-9-]*$/.test(v) || 'dash-case, lowercase',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{#if (isQuery type)}}queries{{else}}commands{{/if}}/{{dashCase name}}.ts',
        templateFile: 'plop-templates/cqrs/handler.hbs',
      },
      {
        type: 'append',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{feature}}.module.ts',
        pattern: /(\/\/ plop:imports)/,
        template:
          "import { {{pascalCase name}}{{pascalCase type}}Handler } from './{{#if (isQuery type)}}queries{{else}}commands{{/if}}/{{dashCase name}}.js'",
      },
      {
        type: 'append',
        path: 'apps/{{app}}/src/modules/{{feature}}/{{feature}}.module.ts',
        pattern: /(\/\/ plop:providers)/,
        template: '    {{pascalCase name}}{{pascalCase type}}Handler,',
      },
    ],
  })

  // fixed-shape SQL gets typed params + rows from the database
  plop.setGenerator('typedsql', {
    description: 'New TypedSQL query in prisma/sql/',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Query name (camelCase, e.g. firmMetricsAsOf):',
        validate: (v) => /^[a-z][a-zA-Z0-9]*$/.test(v) || 'camelCase',
      },
      { type: 'input', name: 'purpose', message: 'One-line purpose:' },
    ],
    actions: [
      {
        type: 'add',
        path: 'prisma/sql/{{camelCase name}}.sql',
        templateFile: 'plop-templates/prisma/typedsql.hbs',
      },
    ],
  })

  // inngest functions are plain functions — deps injected from main.ts, no cqrs inside
  plop.setGenerator('inngest', {
    description: 'New Inngest queue consumer (reminder: register it in inngest.registry.ts)',
    prompts: [
      appPrompt,
      featurePrompt,
      {
        type: 'input',
        name: 'name',
        message: 'Function name (dash-case, e.g. refresh-search):',
        validate: (v) => /^[a-z][a-z0-9-]*$/.test(v) || 'dash-case, lowercase',
      },
      {
        type: 'input',
        name: 'eventKey',
        message: 'EVENTS key (SCREAMING_SNAKE, e.g. MARKET_REFRESH_SEARCH):',
        validate: (v) => /^[A-Z][A-Z0-9_]*$/.test(v) || 'SCREAMING_SNAKE_CASE',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'apps/{{app}}/src/modules/{{feature}}/queues/{{dashCase name}}.ts',
        templateFile: 'plop-templates/inngest/function.hbs',
      },
      () =>
        'Now: add the key + zod schema to libs/system/queues/events.config.ts, add the command it dispatches, then register the consumer in the app\'s inngest.registry.ts',
    ],
  })
}
