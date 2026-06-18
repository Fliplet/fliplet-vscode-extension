# Multi-Organization Feature Implementation Plan

## Overview

This document outlines the implementation plan for adding multi-organization switching functionality to the Fliplet VS Code Extension. The feature will allow users to switch between different organizations they have access to, similar to how it works in Fliplet Studio.

## Requirements

- Allow users to view all organizations they have access to
- Enable switching between organizations via Command Palette
- Persist the selected organization
- Refresh the extension view after switching
- Follow similar implementation pattern as the Impersonation feature

## Implementation Plan

### 1. Add Command Registration

Register a new command in the extension's `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "fliplet.switchOrganization",
        "title": "Fliplet: Switch Organization"
      }
    ]
  }
}
```

### 2. Implement Organization Switching Logic

Create a new module in `src/commands/switchOrganization.ts`:

```typescript
import * as vscode from 'vscode';
import { auth } from '../services/auth';
import { refreshWebviewContent } from '../webview';

export async function switchOrganization() {
  try {
    // Get list of organizations the user has access to
    const organizations = await auth.getUserOrganizations();
    
    if (!organizations || !organizations.length) {
      vscode.window.showInformationMessage('No organizations found.');
      return;
    }

    // Display organizations in the Command Palette
    const orgItems = organizations.map(org => ({
      label: org.name,
      description: `ID: ${org.id}`,
      detail: org.region,
      org
    }));

    const selectedOrg = await vscode.window.showQuickPick(orgItems, {
      placeHolder: 'Select an organization to switch to',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selectedOrg) {
      return; // User cancelled
    }

    // Switch the organization
    await auth.changeCurrentOrganization({
      newOrganizationId: selectedOrg.org.id,
      region: selectedOrg.org.region
    });

    // Refresh the extension view
    refreshWebviewContent();
    
    vscode.window.showInformationMessage(`Switched to organization: ${selectedOrg.org.name}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to switch organization: ${error.message}`);
  }
}
```

### 3. Update Auth Service

Add methods to `src/services/auth.ts` to support organization operations:

```typescript
// Add to auth service
async getUserOrganizations() {
  // API call to get user organizations
  const response = await this.authenticatedRequest('/v1/user/organizations');
  return response.organizations || [];
}

async changeCurrentOrganization({ newOrganizationId, region }) {
  // Mimic the functionality in TopbarMenuOrganizationSwitcher.vue
  const response = await this.authenticatedRequest('/v1/user/organization', {
    method: 'PUT',
    body: JSON.stringify({
      id: newOrganizationId,
      region
    })
  });
  
  // Update and persist the selected organization
  await this.updateAndPersistOrganization(response.organization);
  
  return response.organization;
}

async updateAndPersistOrganization(organization) {
  // Update the organization in memory
  this.organization = organization;
  
  // Persist to local storage
  await this.storageService.set('currentOrganization', organization);
  
  return organization;
}
```

### 4. Update the Extension Activation

Register the command in the extension's activation function in `src/extension.ts`:

```typescript
import { switchOrganization } from './commands/switchOrganization';

export function activate(context: vscode.ExtensionContext) {
  // Other initialization code...
  
  // Register the command
  context.subscriptions.push(
    vscode.commands.registerCommand('fliplet.switchOrganization', switchOrganization)
  );
}
```

### 5. Add Interface for Organization Types

Create or update types in `src/types.ts`:

```typescript
export interface Organization {
  id: string;
  name: string;
  region: string;
  // Other organization properties
}
```

## Testing Plan

1. Test with users that have access to multiple organizations
2. Verify organization list is correctly displayed in Command Palette
3. Test switching between organizations
4. Verify app list is updated after organization switch
5. Verify persistence of selected organization after VS Code restart

## Future Enhancements

- Add organization search functionality
- Display current organization in the status bar
- Add organization filtering options
- Consider adding a UI component in the sidebar for organization switching 