FROM public.ecr.aws/lambda/python:3.9-x86_64
RUN yum install -y ImageMagick \
                   ImageMagick-devel
COPY requirements.txt  .
RUN  pip3 install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"
COPY *.py ${LAMBDA_TASK_ROOT}/