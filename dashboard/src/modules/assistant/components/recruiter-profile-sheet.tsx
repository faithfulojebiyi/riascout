import { useEffect, useMemo, useState } from 'react';

import { Box, Flex, HStack, styled } from '@riascout-ui/styled-system/jsx';

import { Button } from '../../../ui/primitives/button';
import { Checkbox } from '../../../ui/primitives/checkbox/checkbox';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../ui/primitives/sheet';
import { TagInput } from '../../../ui/primitives/tag-input';
import { Textarea } from '../../../ui/primitives/textarea';
import { toast } from '../../../ui/primitives/toast/toast';
import { useFetchFacets } from '../../prospecting/queries/use-fetch-facets';
import {
  type RecruiterProfile,
  useRecruiterProfile,
  useUpdateRecruiterProfile,
} from '../queries/use-recruiter-profile';
import {
  setRecruiterProfileOpen,
  useRecruiterProfileOpen,
} from '../recruiter-profile-store';

const FIRM_PATTERN = /^(.*?)(?:\s*\((\d+)\))?$/;

/** "Name (CRD)" tags, so a firm keeps its identity when it is remembered */
const firmToTag = (firm: { name: string; crd?: string }): string =>
  firm.crd ? `${firm.name} (${firm.crd})` : firm.name;

const tagToFirm = (tag: string): { name: string; crd?: string } => {
  const match = FIRM_PATTERN.exec(tag.trim());
  const name = match?.[1]?.trim() || tag.trim();
  const crd = match?.[2];

  return crd ? { name, crd } : { name };
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <Box>
    <styled.label display="block" fontSize="1" fontWeight="500" mb="1">
      {label}
    </styled.label>
    {children}
    {hint ? (
      <styled.p color="text.muted" fontSize="0.688" mt="1">
        {hint}
      </styled.p>
    ) : null}
  </Box>
);

/**
 * The recruiter's standing preferences, the same record the assistant reads
 * and writes as working memory. Edits here win over anything it inferred.
 */
export const RecruiterProfileSheet = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const profile = useRecruiterProfile();
  const update = useUpdateRecruiterProfile();
  const facets = useFetchFacets('advisor');
  const [draft, setDraft] = useState<RecruiterProfile>({});

  useEffect(() => {
    if (open && profile.data) setDraft(profile.data);
  }, [open, profile.data]);

  const suggestionsFor = useMemo(() => {
    const byKey = new Map(
      (facets.data?.facets ?? []).map((facet) => [facet.allowKey, facet]),
    );

    return (allowKeys: string[]) =>
      allowKeys.flatMap((key) =>
        (byKey.get(key)?.options ?? []).map((option) => ({
          id: option.value,
          text: option.value,
        })),
      );
  }, [facets.data]);

  const set = <K extends keyof RecruiterProfile>(
    key: K,
    value: RecruiterProfile[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async (next: RecruiterProfile) => {
    try {
      await update.mutateAsync(next);
      toast.success(
        Object.keys(next).length === 0 ? 'Memory cleared' : 'Preferences saved',
      );
      onOpenChange(false);
    } catch {
      toast.error('Could not save preferences');
    }
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent maxW="calc(100vw - 16px)" w="700px">
        <SheetHeader>
          <SheetTitle>What the assistant remembers</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <Flex direction="column" gap="4">
            <styled.p color="text.muted" fontSize="1" lineHeight="1.5">
              These fill in gaps when you do not say otherwise. Anything you
              type in a message always wins. The assistant may add to this when
              you state a durable preference; it says so when it does.
            </styled.p>

            <Field
              hint="State codes. Used as the default location filter."
              label="Territory"
            >
              <TagInput
                placeholder="TX, OK"
                setValue={(value) => set('territory', value)}
                suggestions={suggestionsFor(['advisor.state'])}
                value={draft.territory ?? []}
              />
            </Field>

            <Field
              hint="Firm AUM band codes, e.g. 1b_5b."
              label="Target firm size"
            >
              <TagInput
                placeholder="1b_5b, 5b_20b"
                setValue={(value) => set('targetAumBands', value)}
                suggestions={suggestionsFor(['advisor.firm_aum_band'])}
                value={draft.targetAumBands ?? []}
              />
            </Field>

            <Field
              hint="Designation names or exam codes exactly as the data spells them."
              label="Credentials you look for"
            >
              <TagInput
                placeholder="S65, Certified Financial Planner (CFP)"
                setValue={(value) => set('credentials', value)}
                suggestions={suggestionsFor([
                  'advisor.exam_codes',
                  'advisor.designations',
                ])}
                value={draft.credentials ?? []}
              />
            </Field>

            <Field
              hint="Channel codes: pure_ria, hybrid, bd_affiliated…"
              label="Firm types you recruit from"
            >
              <TagInput
                placeholder="pure_ria"
                setValue={(value) => set('firmTypes', value)}
                suggestions={suggestionsFor(['advisor.firm_channel'])}
                value={draft.firmTypes ?? []}
              />
            </Field>

            <Field
              hint='Write "Name (CRD)" so the firm keeps its identity.'
              label="Firms you recruit for"
            >
              <TagInput
                placeholder="Example Wealth (123456)"
                setValue={(value) =>
                  set('firmsRecruitedFor', value.map(tagToFirm))
                }
                value={(draft.firmsRecruitedFor ?? []).map(firmToTag)}
              />
            </Field>

            <Field label="Answers">
              <HStack gap="4">
                <HStack gap="2">
                  <Checkbox
                    checked={draft.outputPreferences?.preferTables ?? false}
                    onCheckedChange={(checked: boolean | 'indeterminate') =>
                      set('outputPreferences', {
                        ...draft.outputPreferences,
                        preferTables: checked === true,
                      })
                    }
                  />
                  <styled.span fontSize="1">Prefer tables</styled.span>
                </HStack>
                <HStack gap="2">
                  <styled.span fontSize="1">Rows per answer</styled.span>
                  <styled.input
                    bg="brand.panel.3"
                    fontSize="1"
                    max={25}
                    min={1}
                    onChange={(event) =>
                      set('outputPreferences', {
                        ...draft.outputPreferences,
                        rowLimit: Number(event.target.value) || undefined,
                      })
                    }
                    px="2"
                    py="1"
                    rounded="md"
                    type="number"
                    value={draft.outputPreferences?.rowLimit ?? ''}
                    w="4rem"
                  />
                </HStack>
              </HStack>
            </Field>

            <Field label="Notes">
              <Textarea
                fontSize="1"
                maxLength={600}
                onChange={(event) => set('notes', event.target.value)}
                placeholder="Anything else the assistant should keep in mind"
                rows={3}
                value={draft.notes ?? ''}
              />
            </Field>
          </Flex>
        </SheetBody>
        <SheetFooter>
          <HStack gap="2" justifyContent="space-between" w="full">
            <Button
              disabled={update.isPending}
              onClick={() => void save({})}
              size="sm"
              variant="ghost"
            >
              Forget everything
            </Button>
            <HStack gap="2">
              <Button
                disabled={update.isPending}
                onClick={() => onOpenChange(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                bg="brand.primary.12"
                color="brand.primary.1"
                disabled={update.isPending || profile.isPending}
                onClick={() => void save(draft)}
                size="sm"
                _hover={{ bg: 'brand.primary.11' }}
              >
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
            </HStack>
          </HStack>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

/** mounted once in the authed layout; the user menu opens it */
export const RecruiterProfileSheetHost = () => {
  const open = useRecruiterProfileOpen();

  return (
    <RecruiterProfileSheet onOpenChange={setRecruiterProfileOpen} open={open} />
  );
};
