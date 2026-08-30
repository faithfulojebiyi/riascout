import { useRef, type ChangeEvent } from 'react';
import { Box, Flex, VStack } from '@riascout-ui/styled-system/jsx';

import { UploadImageContentType } from '../../../api/generated/rIAScoutAPI.schemas';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../../../ui/primitives/avatar';
import { Button } from '../../../ui/primitives/button';
import { Span } from '../../../ui/primitives/text';
import { toast } from '../../../ui/primitives/toast/toast';
import { useUploadImage } from '../mutations/use-onboarding-steps';

const ACCEPTED = Object.values(UploadImageContentType);
const MAX_BYTES = 5 * 1024 * 1024;

export type ImageFieldProps = {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** initials behind a missing image, so the circle is never blank */
  fallback: string;
  rounded?: 'full' | 'md';
};

/** narrows the file's type to what the api will accept, before spending an upload */
const isAccepted = (type: string): type is (typeof ACCEPTED)[number] =>
  (ACCEPTED as string[]).includes(type);

export const ImageField = ({
  label,
  value,
  onChange,
  fallback,
  rounded = 'full',
}: ImageFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // reset immediately so picking the same file twice still fires a change
    event.target.value = '';

    if (!file) return;

    if (!isAccepted(file.type)) {
      toast.error('Pick a PNG, JPEG or WebP');

      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error('Images are limited to 5MB');

      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Could not read that file'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });

      const result = await upload.mutateAsync({
        contentType: file.type,
        data: dataUrl.slice(dataUrl.indexOf(',') + 1),
      });

      onChange(result.url);
    } catch {
      // the mutation's onError already reported it; keep the current image
    }
  };

  return (
    <Flex align="center" gap="4">
      <Avatar radius={rounded} size={5} variants="soft">
        {value ? <AvatarImage alt={label} src={value} /> : null}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>

      <VStack alignItems="flex-start" gap="2">
        <Span fontSize="2" fontWeight="500">
          {label}
        </Span>

        <Flex gap="2">
          <Button
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            {upload.isPending
              ? 'Uploading…'
              : value
                ? 'Replace image'
                : 'Upload image'}
          </Button>
          <Button
            disabled={!value || upload.isPending}
            onClick={() => onChange(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Remove
          </Button>
        </Flex>

        <Span color="text.placeholder" fontSize="1">
          PNG, JPEG or WebP up to 5MB
        </Span>
      </VStack>

      <Box display="none">
        <input
          accept={ACCEPTED.join(',')}
          onChange={(event) => void onPick(event)}
          ref={inputRef}
          type="file"
        />
      </Box>
    </Flex>
  );
};
