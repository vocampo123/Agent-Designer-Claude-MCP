# Metadata Enhancements — Production-Grade Agent Scripts

## Overview

Enhanced the Agentforce agent script generator to produce production-quality output with rich metadata that improves the Agentforce Builder UX across all agent domains (customer service, sales, HR, intake, etc.).

## What Was Added

### 1. **Config Block Extensions**

```yaml
config:
    agent_name: "MyAgent_20260616143022"
    agent_label: "My Agent Display Name"
    description: "Agent description"
    agent_type: "AgentforceEmployeeAgent"    # NEW: Agent type specification
```

Supported agent types:
- `AgentforceEmployeeAgent` — Internal employee-facing agents
- `ServiceAgent` — Customer service agents
- *(extensible for future types)*

---

### 2. **Knowledge Block**

```yaml
knowledge:
    citations_enabled: False    # NEW: Control knowledge base citations
```

Use cases:
- Enable for agents that reference documentation/policies
- Disable for transactional agents that don't need citations

---

### 3. **Variable Enhancements**

#### Visibility Control
```yaml
variables:
    currentRecordId: mutable string = ""
        visibility: "External"    # NEW: Exposed to platform context
    
    internalState: mutable string = ""
        visibility: "Internal"    # NEW: Agent-only state
```

#### Linked Variables
```yaml
variables:
    ContactId: linked string    # NEW: Linked variable type
        source: @MessagingEndUser.ContactId    # NEW: Platform binding
        description: "Contact ID from messaging context"
        visibility: "External"
```

**Smart defaults:** Auto-infers visibility based on variable name patterns.

---

### 4. **Enhanced Action Metadata**

Before (minimal):
```yaml
actions:
    CreateRecord:
        description: "Creates a record"
        inputs:
            recordId: string
        target: "flow://CreateRecord"
```

After (production-grade):
```yaml
actions:
    CreateRecord:
        description: "Creates a record in Salesforce"
        label: "Create Record"                           # NEW: Display name
        require_user_confirmation: True                  # NEW: Safety flag
        include_in_progress_indicator: True              # NEW: UX feedback
        progress_indicator_message: "Creating record..." # NEW: User-facing message
        source: "MyAgent__CreateRecord"                  # NEW: Namespace convention
        
        inputs:
            "recordId": lightning__recordIdType          # NEW: Platform type
                description: "The record ID"
                label: "Record ID"                       # NEW: Display label
                is_required: True                        # NEW: Validation
                is_user_input: False                     # NEW: System vs user
                complex_data_type_name: "lightning__recordIdType"  # NEW
        
        outputs:
            "newRecordId": lightning__recordIdType
                description: "ID of created record"
                label: "New Record ID"
                is_displayable: True                     # NEW: Show in UI
                filter_from_agent: False                 # NEW: Agent visibility
                complex_data_type_name: "lightning__recordIdType"
        
        target: "flow://CreateRecord"
```

**Smart defaults:**
- `label` — Inferred from name (snake_case → Title Case)
- `require_user_confirmation` — Auto-enabled for Create/Update/Delete actions
- `progress_indicator_message` — Generated from action name ("Create Record" → "Creating record...")
- `source` — Follows namespace convention (`AgentName__ActionName`)
- `complex_data_type_name` — Inferred from parameter type/name
- `is_user_input` — Auto-detected (user-provided vs system context)
- `is_displayable` — IDs hidden by default, other outputs shown

---

### 5. **Topic/Subagent Enhancements**

```yaml
subagent MyTopic:
    label: "My Topic Display Name"    # NEW: Builder UI label
    description: "Topic description"
    
    actions:
        # ... enhanced actions as shown above
```

---

### 6. **Start Agent Label**

```yaml
start_agent topic_selector:
    label: "Topic Selector"    # NEW: Display name
    description: "Routes conversations to appropriate topics"
```

---

### 7. **Language Block Extensions**

```yaml
language:
    default_locale: "en_US"
    additional_locales: "en_GB,es"    # NEW: Additional locale support
```

---

## Smart Defaults (Domain-Agnostic)

All metadata inference works across ANY agent domain:

### Type Inference
```typescript
// Parameter name patterns → Platform types
"customerId"        → lightning__recordIdType
"dueDate"           → lightning__dateType
"createdDateTime"   → lightning__dateTimeStringType
"notes"             → lightning__richTextType
```

### Action Safety
```typescript
// Action name patterns → Confirmation required
"createRecord"      → require_user_confirmation: True
"deleteCase"        → require_user_confirmation: True
"searchCustomers"   → require_user_confirmation: False
```

### Label Generation
```typescript
// Name → Display label
"create_case"       → "Create Case"
"searchInventory"   → "Search Inventory"
```

### Progress Messages
```typescript
// Action → Progress message
"Create Case"       → "Creating case..."
"Search Inventory"  → "Searching inventory..."
```

---

## Backward Compatibility

✅ **All enhancements are optional** — existing agents without metadata still work
✅ **Smart defaults applied automatically** — minimal input required
✅ **Explicit values override defaults** — full control when needed

---

## Usage

### Minimal Input (Auto-Enhanced)
```typescript
const formData: AgentFormData = {
  config: {
    developer_name: "MyAgent",
    agent_label: "My Agent",
    description: "My agent description"
  },
  actions: [{
    name: "create_record",
    description: "Creates a record",
    inputs: [{ name: "recordId", type: "id" }],
    // ... rest minimal
  }]
};

// Generator auto-adds:
// - label: "Create Record"
// - require_user_confirmation: true
// - progress_indicator_message: "Creating record..."
// - source: "MyAgent__create_record"
// - complexDataTypeName: "lightning__recordIdType"
// - etc.
```

### Explicit Metadata (Full Control)
```typescript
const formData: AgentFormData = {
  config: {
    developer_name: "MyAgent",
    agent_label: "My Agent",
    description: "My agent description",
    agent_type: "AgentforceEmployeeAgent"  // Explicit
  },
  knowledge: {
    citations_enabled: false
  },
  actions: [{
    name: "create_record",
    label: "Create Customer Record",       // Override default
    requireUserConfirmation: true,
    progressIndicatorMessage: "Saving...", // Custom message
    // ...
  }]
};
```

---

## Testing

Validated across agent domains:
- ✅ Customer Service (search customer, create case)
- ✅ Sales (qualify lead, create opportunity)
- ✅ HR (submit PTO, check policy)
- ✅ Finance (approve expense, generate report)
- ✅ Program Intake (create application, check eligibility)

All smart defaults work universally without domain-specific logic.

---

## Files Modified

1. **`src/types/agent.ts`** — Extended interfaces with new metadata fields
2. **`src/lib/metadataInference.ts`** — NEW: Smart defaults engine
3. **`src/lib/agentScriptGenerator.ts`** — Enhanced DSL output with full metadata

---

## Next Steps (Optional Future Enhancements)

- [ ] Instruction template system (composable reasoning patterns)
- [ ] Action metadata validation (catch missing required fields)
- [ ] Metadata presets for common action patterns
- [ ] Builder UI preview mode (show what metadata looks like in Builder)

---

Generated: 2026-06-16
