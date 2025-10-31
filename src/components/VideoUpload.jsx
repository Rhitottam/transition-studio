import { useCallback, useState } from 'react';

function VideoUpload({ onFilesSelected }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleFiles = useCallback(async (files) => {
        const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));

        if (videoFiles.length === 0) {
            alert('Please select valid video files');
            return;
        }

        setIsLoading(true);
        try {
            await onFilesSelected(videoFiles);
        } catch (error) {
            console.error('Error loading videos:', error);
            alert('Error loading videos: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [onFilesSelected]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleClick = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.multiple = true;
        input.onchange = (e) => {
            if (e.target.files) {
                handleFiles(e.target.files);
            }
        };
        input.click();
    }, [handleFiles]);

    if (isLoading) {
        return (
            <div className="upload-area loading">
                <div className="upload-icon">⏳</div>
                <h3>Loading videos...</h3>
                <p>Please wait while we process your files</p>
            </div>
        );
    }

    return (
        <div
            className={`upload-area ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <div className="upload-icon">📹</div>
            <h3>Upload Video Files</h3>
            <p>Click to select or drag & drop multiple video files</p>
        </div>
    );
}

export default VideoUpload;
